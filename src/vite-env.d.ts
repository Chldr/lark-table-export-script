/// <reference types="vite/client" />
interface ResponseBase<DataType = any> {
  code: number;
  msg: string;
  data: DataType;
}

interface Dictionary<T = any> {
  [index: string]: T;
}

type ValueOf<T> = T[keyof T];
