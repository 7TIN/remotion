import fs from "fs";
import path from "path";

export async function GET(req: Request) {
  const {searchParams} = new URL(req.url);

  const file = searchParams.get("file");

  if (!file) {
    return new Response("Missing file", {
      status: 400,
    });
  }

  const filePath = path.join(
    process.cwd(),
    "out",
    file,
  );

  if (!fs.existsSync(filePath)) {
    return new Response("Not found", {
      status: 404,
    });
  }

  const buffer = fs.readFileSync(filePath);

  return new Response(buffer, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition":
        `attachment; filename="${file}"`,
    },
  });
}