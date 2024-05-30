import * as Mongoose from "mongoose";
import { Model } from "mongoose";

const VideoSchema = new Mongoose.Schema({
  url: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

//how our post looks like
interface videoProps {
  url: string;
}

interface IPostDocument extends videoProps, Document {}
interface IPostModel extends Model<IPostDocument> {}

//postSchema->Document->Model

// const PostModel: IPostModel = Mongoose.model<IPostDocument>("post", postSchema);

const VIdeoModel: IPostModel =
  Mongoose.models.video || Mongoose.model<IPostDocument>("video", VideoSchema);

export default VIdeoModel;
