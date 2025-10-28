import { NextApiRequest, NextApiResponse } from "next";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import s3 from "@/lib/s3client";
import { Readable } from "stream";

async function streamToString(stream: Readable) {
  const chunks: any[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { fileName } = req.query;
  if (!fileName) return res.status(400).json({ error: "fileName is required" });

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileName as string,
    });

    const data = await s3.send(command);
    const bodyContent = await streamToString(data.Body as Readable);

    res.status(200).json({ content: bodyContent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to download file" });
  }
}
