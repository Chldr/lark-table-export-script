import "./App.css";
import { bitable, IOpenSegmentType } from "@lark-base-open/js-sdk";
import { uploadJSON } from "./utils/upload";
import { createClient } from "./utils/oss";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type RecordContentType = {
  dir: string;
  text: string;
  lang_zh: string;
  team: string;
};
// type BaseResponse<DataType = unknown> = {
//   code: number;
//   msg: string | null;
//   data: DataType | null;
// };

// const INF_MONKEY_API_DOMAIN = "http://api.infmonkeys.hg.com:80/api";
// function infMonkeyAPI(path: string) {
//   return `${INF_MONKEY_API_DOMAIN}${path}`;
// }

// /**
//  * 上传文件到 S3
//  * @param {string} fileKey
//  * @param {File} file
//  * @returns
//  */
// export async function uploadFile(fileKey: string, file: File): Promise<string> {
//   const { baseUrl } = (await fetch(infMonkeyAPI("/medias/s3/configs")).then((res) => res.json())) ?? {};
//   console.log("baseUrl: ", baseUrl);
//   // filekey 建议为 frame/files/xxxx.json
//   const uploadUrl = await fetch(infMonkeyAPI(`/medias/s3/presign?key=${fileKey}`)).then((res) => res.json());
//   console.log("uploadUrl: ", uploadUrl);
//   // file 为文件对象（File）

//   await fetch(uploadUrl, {
//     method: "PUT",
//     body: file,
//   }).then((res) => res.json());
//   // 可以通过这个链接访问到上传好的文件
//   const fullUrl = baseUrl + fileKey;
//   console.log("fullUrl: ", fullUrl);
//   return fullUrl;
// }

export default function App() {
  const replace = async () => {
    // Get the current selection
    const selection = await bitable.base.getSelection();
    console.log("selection: ", selection);
    // Find current table by tableId
    const table = await bitable.base.getTableById(selection?.tableId!);
    console.log("table: ", table);

    // Get table's field meta list
    const fieldMetaList = await table.getFieldMetaList();
    console.log("fieldMetaList: ", fieldMetaList);
    // Find the field with the same name as Multiline or 多行文本
    const textFields = fieldMetaList.filter(({ type }) => type === 1);
    // 单选列
    const singleSelectFields = fieldMetaList.filter(({ type }) => type === 3);
    console.log("singleSelectFields: ", singleSelectFields);
    console.log("textField: ", textFields);
    // Get all records
    const recordIdList = await table.getRecordIdList();
    const wordList: RecordContentType[] = [];
    const negativeWordList: RecordContentType[] = [];
    const teamSet = new Set<string>();

    if (!textFields) return;
    console.log("recordIdList: ", recordIdList);
    for (let i = 0; i < recordIdList.length; i++) {
      let isNegativeRecord = false;
      const obj: RecordContentType = {
        dir: "",
        text: "",
        lang_zh: "",
        team: "",
      };
      const negativeFields = textFields.filter((field) => field.name.includes("负面词"));
      const forPromptFields = textFields.filter((field) => field.name.includes("关键词"));
      // 如果负面词有值，isNegativeRecord  设置为 true
      const negativeFieldValueMap = negativeFields.reduce<{ [id: string]: string }>((map, f) => {
        map[f.id] = "";
        return map;
      }, {});
      for (const field of negativeFields) {
        const cellString = await table.getCellString(field.id!, recordIdList[i]!);
        negativeFieldValueMap[field.id] = cellString;
        if (cellString) {
          const fieldName = field.name.split("-").at(-1) ?? field.name;
          obj[fieldName as keyof RecordContentType] = cellString;
        }
      }
      if (Object.values(negativeFieldValueMap).some(value => !!value)) {
        isNegativeRecord = true;
      }

      
      if (!isNegativeRecord) {
        for (const field of forPromptFields) {
          // Get cell string from specified fieldId and recordId
          const cellString = await table.getCellString(field.id!, recordIdList[i]!);
          const fieldName = field.name.split("-").at(-1) ?? field.name;
          obj[fieldName as keyof RecordContentType] = cellString;
        }
      }

      for (const field of singleSelectFields) {
        const cellString = await table.getCellString(field.id!, recordIdList[i]!);
        const fieldName = field.name.split("-").at(-1) ?? field.name;
        obj[fieldName as keyof RecordContentType] = cellString;
      }

      // 加上团队项
      if (!obj.team) {
        continue;
      }
      if (!teamSet.has(obj.team)) {
        teamSet.add(obj.team);
      }

      // 加上词条
      if (Object.values(obj).some(v => !v)) {
        continue;
      }
      
      if (isNegativeRecord) {
        negativeWordList.push(obj);
      } else {
        wordList.push(obj);
      }
    }

    const teams = Array.from(teamSet);
    // 区分处理
    // 预设词条表
    const PRESET_DIR = "展示";
    const PRESET_TEAM = "默认";

    // 词块表
    const promptTableMap = teams.reduce<Record<string, Array<RecordContentType>>>((obj, team) => {
      obj[team] = [];
      return obj;
    }, {});

    // 预设词条表
    const presetPromptMap = teams.reduce<Record<string, Array<RecordContentType>>>((obj, team) => {
      obj[team] = [];
      return obj;
    }, {});

     // 负面词表
    const negativePromptTableMap = teams.reduce<Record<string, Array<RecordContentType>>>((obj, team) => {
      obj[team] = [];
      return obj;
    }, {});

    wordList.forEach((record) => {
      const { team, dir } = record;
      if (team) {
        if (dir === PRESET_DIR) {
          if (record.text) {
            presetPromptMap[team].push(record);
          }
        } else {
          if (record.text) {
            promptTableMap[team].push(record);
          }
        }
      }
    });

    negativeWordList.forEach((record) => {
      const { team, dir } = record;
      if (team) {
        if (dir === PRESET_DIR) {
          // if (record.text) {
          //   presetPromptMap[team].push(record);
          // }
        } else {
          if (record.text) {
            negativePromptTableMap[team].push(record);
          }
        }
      }
    })

    console.log("wordList", wordList);
    console.log("negativeWordList", negativeWordList);
    console.log("promptTableMap: ", promptTableMap);
    console.log("presetPromptMap: ", presetPromptMap);
    console.log('negativePromptTableMap: ', negativePromptTableMap);

    // 词块表
    const promptTableMapJsonStr = JSON.stringify(promptTableMap);
    //  预设词条表
    const presetPromptMapJsonStr = JSON.stringify(presetPromptMap);
    // 负面词块表
    const  negativePromptTableMapJsonStr = JSON.stringify(negativePromptTableMap);
    
    const ossPath = "/creator/haier/";

    const { client: ossClient } = await createClient();
    Promise.all([
      uploadJSON(promptTableMapJsonStr, ossClient, "prompt-table.json", ossPath),
      uploadJSON(presetPromptMapJsonStr, ossClient, "preset-prompts.json", ossPath),
      uploadJSON(negativePromptTableMapJsonStr, ossClient, "negative-prompt-table.json", ossPath),
    ]).then((res) => {
      console.log("uploaded all", res);

      if (!!res?.[0]?.url && !!res?.[1]?.url) {
        toast.success("上传成功");
      } else {
        toast.error("上传遇到问题，请重试");
      }
    });
  };

  // function download(context: Blob, name: string) {
  //   const a = document.createElement("a");
  //   a.setAttribute("download", name);
  //   let url = URL.createObjectURL(context);
  //   a.href = url;
  //   a.click();
  //   a.remove();
  //   setTimeout(() => {
  //     URL.revokeObjectURL(url);
  //   }, 1000);
  // }

  return (
    <main>
      <button className="export-btn" onClick={replace}>
        上传词表
      </button>
    </main>
  );
}
