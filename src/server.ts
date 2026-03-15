import express from "express";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import cookieSession from "cookie-session";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Cookie session for storing tokens
app.use(cookieSession({
  name: 'session',
  keys: [process.env.COOKIE_SECRET || 'academic-premium-secret'],
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  secure: true,
  sameSite: 'none'
}));

app.use(express.json());

const getOAuthClient = (req: express.Request) => {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['host'];
  // Use APP_URL if available, otherwise construct from request
  const appUrl = process.env.APP_URL || `${protocol}://${host}`;
  const redirectUri = `${appUrl}/auth/google/callback`;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn("GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não configurados. Exportação para Google Docs não funcionará.");
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
};

// --- Auth Routes ---

app.get("/api/auth/google/url", (req, res) => {
  const oauth2Client = getOAuthClient(req);
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/documents'
    ],
    prompt: 'consent'
  });
  res.json({ url });
});

app.get("/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  const oauth2Client = getOAuthClient(req);

  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    req.session!.tokens = tokens;

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Autenticação concluída com sucesso. Esta janela fechará automaticamente.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error exchanging code for tokens:", error);
    res.status(500).send("Erro na autenticação.");
  }
});

app.get("/api/auth/status", (req, res) => {
  res.json({ isAuthenticated: !!req.session?.tokens });
});

app.post("/api/auth/logout", (req, res) => {
  req.session = null;
  res.json({ success: true });
});

// --- Google Docs & Drive Routes ---

app.post("/api/google/export", async (req, res) => {
  if (!req.session?.tokens) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  const { title, content } = req.body;
  const oauth2Client = getOAuthClient(req);
  oauth2Client.setCredentials(req.session.tokens);

  const docs = google.docs({ version: 'v1', auth: oauth2Client });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  try {
    // 1. Create a new Google Doc
    const doc = await docs.documents.create({
      requestBody: { title }
    });

    const documentId = doc.data.documentId;

    // 2. Insert content into the Doc
    // We'll do a simple batchUpdate to insert text
    await docs.documents.batchUpdate({
      documentId: documentId!,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: content
            }
          }
        ]
      }
    });

    // 3. Get the export link for PDF
    // In Drive API v3, we use files.export
    const pdfResponse = await drive.files.export({
      fileId: documentId!,
      mimeType: 'application/pdf'
    }, { responseType: 'arraybuffer' });

    // 4. Return the document URL and PDF data (as base64 or similar)
    // Or just return the document URL and let the user download it from Drive
    // But the user asked for a "download button", so we'll provide the PDF data
    
    const pdfBase64 = Buffer.from(pdfResponse.data as any).toString('base64');

    res.json({
      success: true,
      documentId,
      documentUrl: `https://docs.google.com/document/d/${documentId}/edit`,
      pdfData: pdfBase64
    });

  } catch (error: any) {
    console.error("Error exporting to Google Docs:", error);
    res.status(500).json({ error: error.message || "Erro ao exportar." });
  }
});

// --- Vite Middleware ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    if (!process.env.GEMINI_API_KEY) {
      console.warn("AVISO: GEMINI_API_KEY não encontrada no ambiente.");
    }
  });
}

startServer().catch(err => {
  console.error("Falha ao iniciar o servidor:", err);
  process.exit(1);
});
