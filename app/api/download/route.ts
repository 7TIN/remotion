import fs from "fs";
import path from "path";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get("file"); // e.g. "MyComp-123456.mp4"

  const filePath = path.join(process.cwd(), "out", path.basename(file!));
  const buffer = fs.readFileSync(filePath);

  return new Response(buffer, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${path.basename(filePath)}"`,
    },
  });
}