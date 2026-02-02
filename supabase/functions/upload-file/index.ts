import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(serviceAccountKey: string): Promise<string> {
  const keyData = JSON.parse(serviceAccountKey);
  
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: keyData.client_email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  const signatureInput = `${headerB64}.${payloadB64}`;
  
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  let pemContents = keyData.private_key.replace(pemHeader, "").replace(pemFooter, "").replace(/\s/g, "");
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(signatureInput)
  );
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  
  const jwt = `${signatureInput}.${signatureB64}`;
  
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const taskId = formData.get("task_id") as string;
    const fileName = formData.get("file_name") as string || file.name;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "File is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    const folderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");

    if (!serviceAccountKey || !folderId) {
      throw new Error("Google Drive credentials not configured");
    }

    const accessToken = await getAccessToken(serviceAccountKey);

    // Create file metadata
    const metadata = {
      name: `${taskId}_${Date.now()}_${fileName}`,
      parents: [folderId],
    };

    // Read file content
    const fileContent = await file.arrayBuffer();

    // Create multipart request
    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataPart = 
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata);

    const encoder = new TextEncoder();
    const metadataBytes = encoder.encode(metadataPart);
    
    const mediaHeader = encoder.encode(
      delimiter + 
      `Content-Type: ${file.type || "application/octet-stream"}\r\n\r\n`
    );
    
    const closeBytes = encoder.encode(closeDelimiter);
    const fileBytes = new Uint8Array(fileContent);

    // Combine all parts
    const body = new Uint8Array(
      metadataBytes.length + mediaHeader.length + fileBytes.length + closeBytes.length
    );
    let offset = 0;
    body.set(metadataBytes, offset); offset += metadataBytes.length;
    body.set(mediaHeader, offset); offset += mediaHeader.length;
    body.set(fileBytes, offset); offset += fileBytes.length;
    body.set(closeBytes, offset);

    // Upload to Google Drive
    const uploadResponse = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: body,
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Google Drive upload error:", errorText);
      throw new Error("Failed to upload to Google Drive");
    }

    const uploadResult = await uploadResponse.json();

    // Make file publicly accessible
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${uploadResult.id}/permissions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "reader",
          type: "anyone",
        }),
      }
    );

    return new Response(
      JSON.stringify({
        fileId: uploadResult.id,
        url: uploadResult.webViewLink,
        downloadUrl: uploadResult.webContentLink,
        name: fileName,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Upload error:", error);
    const errorMessage = error instanceof Error ? error.message : "Upload failed";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
