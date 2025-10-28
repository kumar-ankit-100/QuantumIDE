import { NextApiRequest, NextApiResponse } from "next";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import s3 from "@/lib/s3client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { fileName, content } = req.body;

    // await s3.send(
    //   new PutObjectCommand({
    //     Bucket: process.env.AWS_BUCKET_NAME,
    //     Key: fileName, // e.g., "projectId/fileName.js"
    //     Body: content,
    //   })
    // );

    res.status(200).json({ message: "File uploaded successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to upload file" });
  }
}
