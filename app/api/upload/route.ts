import { NextResponse } from "next/server";
import { pipeline } from "stream";
import { promisify } from "util";
import Ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/config";
import { dbConnect } from "@/app/lib/db";
import VIdeoModel from "@/app/model/videoschema";

const pump = promisify(pipeline);

export async function POST(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();
    const file: any = formData.getAll("video")[0];
    const fileName = file.name;

    // Create separate temporary directories for uploaded files and HLS
    const uploadDir = path.join("/tmp", "uploads");
    const hlsDir = path.join("/tmp", "hls");
    fs.mkdirSync(uploadDir, { recursive: true });
    fs.mkdirSync(hlsDir, { recursive: true });

    const fileId = uuidv4();
    const uploadFilePath = path.join(uploadDir, fileId + "_" + fileName);
    const uploadFileStream = fs.createWriteStream(uploadFilePath);
    await pump(file.stream(), uploadFileStream);

    const metadata: any = await new Promise((resolve, reject) => {
      Ffmpeg.ffprobe(uploadFilePath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata);
        }
      });
    });

    const hasAudio: any = metadata.streams.some(
      (stream: any) => stream.codec_type === "audio"
    );

    const hlsOutputDir = path.join(hlsDir, fileId);
    fs.mkdirSync(hlsOutputDir, { recursive: true });

    const ffmpegCommand = Ffmpeg(uploadFilePath)
      .output(path.join(hlsOutputDir, "index.m3u8"))
      .outputOptions(["-c:v copy"]);

    if (hasAudio) {
      ffmpegCommand.outputOptions(["-c:a copy"]);
    }

    return await new Promise((resolve, reject) => {
      ffmpegCommand
        .outputOptions([
          "-start_number 0",
          "-hls_time 10",
          "-hls_list_size 0",
          "-f hls",
        ])
        .on("start", (commandLine: string) => {
          console.log(`FFmpeg command: ${commandLine}`);
        })
        .on("progress", (progress: any) => {
          console.log(`Processing: ${progress.percent}% done`);
        })
        .on("end", async () => {
          console.log("Conversion completed successfully.");

          try {
            const files = fs.readdirSync(hlsOutputDir);
            const uploadPromises = files.map(async (file) => {
              const filePath = path.join(hlsOutputDir, file);
              const storageRef = ref(storage, `hls/${fileId}/${file}`);
              const fileBuffer = fs.readFileSync(filePath);
              await uploadBytes(storageRef, fileBuffer);
              return getDownloadURL(storageRef); // Return the download URL
            });

            const fileUrls = await Promise.all(uploadPromises);

            // Read the index.m3u8 file
            const indexFilePath = path.join(hlsOutputDir, "index.m3u8");
            let indexFileContent = fs.readFileSync(indexFilePath, "utf-8");

            // Replace local paths with Firebase paths
            indexFileContent = indexFileContent.replace(
              /index(\d+)\.ts/g,
              (match, p1) => {
                return `https://firebasestorage.googleapis.com/v0/b/video-streamer-next.appspot.com/o/hls%2F${fileId}%2Findex${p1}.ts?alt=media&token=${uuidv4()}`;
              }
            );

            // Write the updated content back to index.m3u8
            fs.writeFileSync(indexFilePath, indexFileContent);

            // Upload the modified index.m3u8 file to Firebase
            const indexFileBuffer = fs.readFileSync(indexFilePath);
            const indexStorageRef = ref(storage, `hls/${fileId}/index.m3u8`);
            await uploadBytes(indexStorageRef, indexFileBuffer);

            // Get download URL for the modified index.m3u8 file
            const indexUrl = await getDownloadURL(indexStorageRef);

            // Save HLS URL to MongoDB
            await dbConnect();
            const hlsData = new VIdeoModel({
              url: indexUrl,
            });
            await hlsData.save();

            // Clean up temporary directories and files
            fs.unlinkSync(uploadFilePath);
            fs.rmSync(hlsOutputDir, { recursive: true });
            fs.rmSync(uploadDir, { recursive: true });

            resolve(
              NextResponse.json(
                {
                  message: "Video uploaded and converted successfully",
                  url: indexUrl,
                },
                { status: 200 }
              )
            );
          } catch (uploadError: any) {
            console.log("error", uploadError);
            reject(
              NextResponse.json(
                {
                  status: "Error uploading video",
                  data: uploadError.message,
                },
                { status: 500 }
              )
            );
          }
        })
        .on("error", (err: any, stdout: string, stderr: string) => {
          console.error("Error during conversion:", err.message);
          console.error("FFmpeg stdout:", stdout);
          console.error("FFmpeg stderr:", stderr);

          // Clean up temporary directories and files on error
          fs.unlinkSync(uploadFilePath);
          fs.rmSync(hlsOutputDir, { recursive: true });
          fs.rmSync(uploadDir, { recursive: true });

          reject(
            NextResponse.json(
              { status: "Error converting video", data: err.message },
              { status: 500 }
            )
          );
        })
        .run();
    });
  } catch (e: any) {
    return NextResponse.json(
      { status: "fail", data: e.message },
      { status: 500 }
    );
  }
}
