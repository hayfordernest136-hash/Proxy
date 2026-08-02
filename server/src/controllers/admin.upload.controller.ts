import { Request, Response } from "express";
import fs from "fs";
import path from "path";

export async function adminUploadHandler(req: Request, res: Response) {
  try {
    const { filename, content_base64 } = req.body;
    if (!filename || !content_base64)
      return res.status(400).json({ message: "filename and content_base64 required" });

    const uploadsDir = path.resolve(process.cwd(), "server", "uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const filePath = path.join(uploadsDir, `${Date.now()}-${safeName}`);
    const buffer = Buffer.from(content_base64, "base64");
    fs.writeFileSync(filePath, buffer);

    // return a relative path the frontend can fetch from the server
    const publicPath = `/uploads/${path.basename(filePath)}`;
    return res.json({ ok: true, url: publicPath });
  } catch (error) {
    console.error("Upload failed:", error);
    return res.status(500).json({ message: "Upload failed" });
  }
}

export default {};
