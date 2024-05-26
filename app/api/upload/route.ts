import { NextResponse } from "next/server";
import fs from "fs";
import { pipeline } from "stream";
import { promisify } from "util";
import Ffmpeg from "fluent-ffmpeg";
import path from "path";

const uploadDir = "./public/upload/";
const hlsDir = "./public/hls/";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

if (!fs.existsSync(hlsDir)) {
  fs.mkdirSync(hlsDir);
}

const pump = promisify(pipeline);

export async function POST(req: Request, res: Response) {
  try {
    const formData = await req.formData();
    const file: any = formData.getAll("video")[0];

    const videoPath = `${uploadDir}${file.name}`;
    const outputDir = path.join(hlsDir, path.parse(file.name).name);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    await pump(file.stream(), fs.createWriteStream(videoPath));

    const metadata: any = await new Promise((resolve, reject) => {
      Ffmpeg.ffprobe(videoPath, (err, metadata) => {
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

    const ffmpegCommand = Ffmpeg(videoPath)
      .output(`${outputDir}/index.m3u8`)
      .outputOptions(["-c:v copy"]);

    if (hasAudio) {
      ffmpegCommand.outputOptions(["-c:a copy"]);
    }

    console.log("Running ffmpeg command...");
    console.log(`Input file: ${videoPath}`);
    console.log(`Output directory: ${outputDir}`);

    return new Promise((resolve, reject) => {
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
        .on("end", () => {
          console.log("Conversion completed successfully.");
          const hlsUrl = `${outputDir}/index.m3u8`.replace("public/", "");
          resolve(
            NextResponse.json(
              {
                message: "Video uploaded and converted successfully",
                url: hlsUrl,
              },
              { status: 200 }
            )
          );
        })
        .on("error", (err: any, stdout: string, stderr: string) => {
          console.error("Error during conversion:", err.message);
          console.error("FFmpeg stdout:", stdout);
          console.error("FFmpeg stderr:", stderr);
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
    console.error("Error in handler:", e);
    return NextResponse.json(
      { status: "fail", data: e.message },
      { status: 500 }
    );
  }
}
