import OSS from "ali-oss";
import { ObjKeysCamelFormat } from "./variableName";
interface OSSConfigType {
  accessKeyId: string;
  accessKeySecret: string;
  stsToken: string;
  endpoint: string;
  bucket: string;
  refreshSTSTokenInterval: string;
}

interface OSSResponseData {
  accessKeyId: string;
  accessKeySecret: string;
  bucketCdn: string;
  bucketEndpoint: string;
  bucketName: string;
  expiration: string;
  securityToken: string;
}

let client: OSS | null = null;
let clientConfig: OSSConfigType | null = null;
let lastUpdateClientTime = 0;
const api = (path: string) => `https://gw.nolibox.com/pixverse-service/${path}`;
export const getOSSConfig = async () => {
  const config = await fetch(api("oss/oss_token"))
    .then((res) => {
      if (res.ok) {
        return res.json();
      } else {
        return Promise.reject(res.text());
      }
    })
    .then((res: any) => {
      const { data } = res as ResponseBase<OSSResponseData>;

      const {
        accessKeyId,
        accessKeySecret,
        bucketEndpoint: endpoint,
        bucketName: bucket,
        expiration: refreshSTSTokenInterval, // 登陆token 过期时间
        securityToken: stsToken,
      } = ObjKeysCamelFormat(data) || {};
      return {
        accessKeyId,
        accessKeySecret,
        stsToken,
        endpoint: endpoint.replace("-internal", ""),
        bucket,
        refreshSTSTokenInterval,
      };
    });

  const ossKeys: Array<keyof OSSConfigType> = [
    "accessKeyId",
    "accessKeySecret",
    "stsToken",
    "endpoint",
    "bucket",
    "refreshSTSTokenInterval",
  ];

  const ossConfig: any = ossKeys.reduce((options: Partial<OSSConfigType>, ossKey: keyof OSSConfigType) => {
    options[ossKey] = config[ossKey];
    return options;
  }, {});
  return {
    ossConfig,
    config,
  };
};
export const createClient = async () => {
  const isNotExpired = (new Date().getTime() - lastUpdateClientTime) / (1000 * 60) < 5;
  if (client && clientConfig && isNotExpired) return { client, config: clientConfig };

  const { ossConfig, config } = await getOSSConfig();
  client = new OSS({
    ...ossConfig,
    // yourRegion填写Bucket所在地域。以华东1（杭州）为例，Region填写为oss-cn-hangzhou。
    region: "oss-cn-hangzhou",
    refreshSTSToken: async () => {
      // 向您搭建的STS服务获取临时访问凭证。
      const { ossConfig: oc } = await getOSSConfig();
      return oc;
    },
  });
  clientConfig = ossConfig;
  lastUpdateClientTime = new Date().getTime();

  return {
    client,
    config,
  };
};

export interface UploadFile {
  file: any;
  filePath: string;
  publicRead?: boolean;
  ossClient?: OSS;
}
export async function clientPut({
  file,
  filePath,
  publicRead = true,
  ossClient,
}: UploadFile): Promise<{ url: string; res: { status?: number; statusCode?: number } }> {
  const _ossClient: OSS = ossClient || ((await createClient()).client as OSS);
  const headers = {
    // 指定该Object被下载时网页的缓存行为。
    // 'Cache-Control': 'no-cache',
    // 指定该Object被下载时的名称。
    // 'Content-Disposition': 'oss_download.txt',
    // 指定该Object被下载时的内容编码格式。
    // 'Content-Encoding': 'UTF-8',
    // 指定过期时间。
    // 'Expires': 'Wed, 08 Jul 2022 16:57:01 GMT',
    // 指定Object的存储类型。
    // 'x-oss-storage-class': 'Standard',
    // 指定Object的访问权限。
    "x-oss-object-acl": "public-read",
    // 设置Object的标签，可同时设置多个标签。
    // 'x-oss-tagging': 'Tag1=1&Tag2=2',
    // 指定CopyObject操作时是否覆盖同名目标Object。此处设置为true，表示禁止覆盖同名Object。
    // 'x-oss-forbid-overwrite': 'true',
  };
  return _ossClient.put(filePath, file, { headers });
}

export async function clientBatchPut(filesData: Array<UploadFile>) {
  const { client: ossClient } = await createClient();
  const promises = filesData.map((item) =>
    ossClient.put(item.filePath, item.file).then((result) => {
      if (item.publicRead !== false) ossClient.putACL(item.filePath, "public-read");
      return result;
    }),
  );

  return Promise.allSettled(promises);
}
