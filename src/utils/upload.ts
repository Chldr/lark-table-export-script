import OSS from "ali-oss";
import { clientPut } from "./oss";

export const uploadJSON = async (json: string, client: OSS, fileName: string, filePath: string) => {
  const file = new File([json], fileName, { type: "application/json" });
  return clientPut({
    file,
    filePath: `${filePath}${fileName}`,
    ossClient: client,
  });
};
