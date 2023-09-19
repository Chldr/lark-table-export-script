import "./App.css";
import { bitable, IOpenSegmentType } from "@lark-base-open/js-sdk";

type RecordContentType = {
  dir: string;
  text: string;
  lang_zh: string;
  team: string;
};
type BaseResponse<DataType = unknown> = {
  code: number;
  msg: string | null;
  data: DataType | null;
};

const INF_MONKEY_API_DOMAIN = "http://api.infmonkeys.hg.com:80/api";
function infMonkeyAPI(path: string) {
  return `${INF_MONKEY_API_DOMAIN}${path}`;
}

/**
 * 上传文件到 S3
 * @param {string} fileKey
 * @param {File} file
 * @returns
 */
export async function uploadFile(fileKey: string, file: File): Promise<string> {
  const { baseUrl } = (await fetch(infMonkeyAPI("/medias/s3/configs")).then((res) => res.json())) ?? {};
  console.log("baseUrl: ", baseUrl);
  // filekey 建议为 frame/files/xxxx.json
  const uploadUrl = await fetch(infMonkeyAPI(`/medias/s3/presign?key=${fileKey}`)).then((res) => res.json());
  console.log("uploadUrl: ", uploadUrl);
  // file 为文件对象（File）

  await fetch(uploadUrl, {
    method: "PUT",
    body: file,
  }).then((res) => res.json());
  // 可以通过这个链接访问到上传好的文件
  const fullUrl = baseUrl + fileKey;
  console.log("fullUrl: ", fullUrl);
  return fullUrl;
}

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
    const teamSet = new Set<string>();

    if (!textFields) return;
    console.log("recordIdList: ", recordIdList);
    for (let i = 0; i < recordIdList.length; i++) {
      const obj: RecordContentType = {
        dir: "",
        text: "",
        lang_zh: "",
        team: "",
      };
      for (const field of textFields) {
        // Get cell string from specified fieldId and recordId
        const cellString = await table.getCellString(field.id!, recordIdList[i]!);
        const fieldName = field.name.split("-").at(-1) ?? field.name;
        obj[fieldName as keyof RecordContentType] = cellString;
      }

      for (const field of singleSelectFields) {
        const cellString = await table.getCellString(field.id!, recordIdList[i]!);
        const fieldName = field.name.split("-").at(-1) ?? field.name;
        obj[fieldName as keyof RecordContentType] = cellString;
      }

      if (!obj.team) continue;
      wordList.push(obj);
      if (!teamSet.has(obj.team)) {
        teamSet.add(obj.team);
      }
    }

    const teams = Array.from(teamSet);
    // 区分处理
    // 预设词条表
    const PRESET_DIR = "展示";
    const PRESET_TEAM = "默认";

    // 词块表
    const promptTableMap = teams.reduce<Record<string, Array<RecordContentType>>>((obj, team) => {
      if (team !== PRESET_TEAM) {
        obj[team] = [];
      }
      return obj;
    }, {});

    // 预设词条表
    const presetPromptMap = teams.reduce<Record<string, Array<RecordContentType>>>((obj, team) => {
      obj[team] = [];
      return obj;
    }, {});

    wordList.forEach((record) => {
      const { team, dir } = record;
      if (team) {
        if (team !== PRESET_TEAM) {
          if (record.text) {
            promptTableMap[team].push(record);
          }
        }
        if (dir === PRESET_DIR) {
          if (record.text) {
            presetPromptMap[team].push(record);
          }
        }
      }
    });

    console.log("wordList", wordList);
    console.log("promptTableMap: ", promptTableMap);
    console.log("presetPromptMap: ", presetPromptMap);

    // 词块表
    const promptTableMapJsonStr = JSON.stringify(promptTableMap);
    //  预设词条表
    const presetPromptMapJsonStr = JSON.stringify(presetPromptMap);

    const promptTableMapFile = new File([promptTableMapJsonStr], "export.json", { type: "application/json" });
    const presetPromptMapFile = new File([presetPromptMapJsonStr], "export.json", { type: "application/json" });

    download(
      promptTableMapFile,
      `prompt-table_${new Date().getFullYear()}/${
        new Date().getMonth() + 1
      }/${new Date().getDate()}:${new Date().getHours()}:${new Date().getMinutes()}:${new Date().getSeconds()}.json`,
    );

    download(
      presetPromptMapFile,
      `preset-prompts_${new Date().getFullYear()}/${
        new Date().getMonth() + 1
      }/${new Date().getDate()}:${new Date().getHours()}:${new Date().getMinutes()}:${new Date().getSeconds()}.json`,
    );

    // const promptTableFileUrl = await uploadFile("frame/files/prompt_table_map.json", promptTableMapFile);
    // console.log("promptTableFileUrl: ", promptTableFileUrl);

    // const presetPromptMapFileUrl = await uploadFile("frame/files/preset_prompt_map.json", presetPromptMapFile);
    // console.log("presetPromptMapFileUrl: ", presetPromptMapFileUrl);
  };

  function download(context: Blob, name: string) {
    const a = document.createElement("a");
    a.setAttribute("download", name);
    let url = URL.createObjectURL(context);
    a.href = url;
    a.click();
    a.remove();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  return (
    <main>
      <button className="export-btn" onClick={replace}>
        导出词表
      </button>
    </main>
  );
}
