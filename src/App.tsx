import "./App.css";
import { bitable, IOpenSegmentType } from "@base-open/web-api";
import { Button } from "@douyinfe/semi-ui";
import { createElement } from "react";

// Text you want to find
const findText = "hi";
// Text you want to replace
const replaceText = "hello";

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
    console.log("textField: ", textFields);
    // Get all records
    const recordIdList = await table.getRecordIdList();
    const arr: any[] = [];
    if (!textFields) return;
    console.log("recordIdList: ", recordIdList);
    for (let i = 0; i < recordIdList.length; i++) {
      const obj: Record<string, string | number> = {
        index: i,
      };
      for (const field of textFields) {
        // Get cell string from specified fieldId and recordId
        const cellString = await table.getCellString(field.id!, recordIdList[i]!);

        obj[field.name] = cellString;

        if (cellString?.includes(findText)) {
          const newText = cellString.replaceAll(findText, replaceText);
          // Update the value of the specified fieldId and recordId
          await table.setCellValue(field?.id!, recordIdList[i]!, [
            {
              type: IOpenSegmentType.Text,
              text: newText,
            },
          ]);
        }
      }
      arr.push(obj);
    }

    const jsonStr = JSON.stringify(arr);
    const jsonFile = new File([jsonStr], "export.json", { type: "application/json" });
    download(jsonFile, "export.json");

    console.log("arr", arr);
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
      <Button theme="solid" type="primary" onClick={replace}>
        Replace hi to hello
      </Button>
    </main>
  );
}
