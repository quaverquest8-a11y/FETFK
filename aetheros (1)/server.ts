import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add our Proxy API Endpoint
  app.get("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send("URL query parameter is required.");
    }

    try {
      let formattedUrl = targetUrl;
      // Handle simple inputs like google.com
      if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = "https://" + formattedUrl;
      }

      const response = await fetch(formattedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      });

      const contentType = response.headers.get("content-type") || "";

      // Relax framing rules so they display in our os-in-an-iframe setup
      res.setHeader("X-Frame-Options", "ALLOWALL");
      res.setHeader("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval'; frame-ancestors *");
      res.setHeader("Access-Control-Allow-Origin", "*");

      if (contentType.includes("text/html")) {
        let html = await response.text();
        const origin = new URL(formattedUrl).origin;

        const baseTag = `<base href="${origin}/">`;
        if (html.includes("<head>")) {
          html = html.replace("<head>", `<head>\n${baseTag}`);
        } else if (html.includes("<HEAD>")) {
          html = html.replace("<HEAD>", `<HEAD>\n${baseTag}`);
        } else {
          html = baseTag + html;
        }

        // Script to intercept navigation clicks and proxy them
        const injectionScript = `
          <script>
            document.addEventListener('click', (e) => {
              const link = e.target.closest('a');
              if (link && link.href) {
                const targetHref = link.href;
                if (targetHref.startsWith('http') || targetHref.startsWith('//')) {
                  e.preventDefault();
                  // Update iframe URL through the proxy
                  window.location.href = '/api/proxy?url=' + encodeURIComponent(targetHref);
                }
              }
            });
          </script>
        `;

        if (html.includes("</body>")) {
          html = html.replace("</body>", `${injectionScript}\n</body>`);
        } else if (html.includes("</BODY>")) {
          html = html.replace("</BODY>", `${injectionScript}\n</BODY>`);
        } else {
          html = html + injectionScript;
        }

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.send(html);
      } else {
        // Pipe images, stylesheets, fonts, and scripts
        res.setHeader("Content-Type", contentType);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return res.send(buffer);
      }
    } catch (error: any) {
      console.error("Proxy error for URL:", targetUrl, error);
      res.status(500).send(`
        <div style="font-family: system-ui, sans-serif; padding: 2.5rem; color: #f87171; background: #0b0c10; height: 100vh; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: #ef4444/10; color: #ef4444; display: flex; justify-content: center; align-items: center; font-size: 24px; margin-bottom: 1rem; border: 2px solid #ef4444;">âš </div>
          <h2 style="margin-top: 0; font-size: 1.5rem; font-weight: 700; color: #e2e8f0;">Proxy Connection Failed</h2>
          <p style="color: #94a3b8; font-size: 0.875rem; max-width: 450px; line-height: 1.5;">AetherOS Secure Cloud Proxy could not reach the requested address: <strong style="color: #a5b4fc; word-break: break-all;">${targetUrl}</strong></p>
          <p style="color: #64748b; font-size: 0.75rem; margin-bottom: 1.5rem;">Reason: ${error.message || error}</p>
          <button onclick="window.location.reload()" style="background: #4f46e5; color: white; border: none; padding: 0.625rem 1.5rem; border-radius: 0.5rem; font-size: 0.875rem; cursor: pointer; font-weight: 600; transition: background 0.15s ease;" onmouseover="this.style.background='#4338ca'" onmouseout="this.style.background='#4f46e5'">Retry Connection</button>
        </div>
      `);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
