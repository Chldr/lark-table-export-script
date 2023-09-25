/**
 * 下划线命名格式 --> 驼峰命名格式
 * @param name
 * @returns {String} camelCaseName
 */
export function snakeToCamel(name: string) {
  return name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * 驼峰命名 --> 下划线命名
 * @param name
 * @returns {String} snakeCase
 */
export function camelToSnake(name: string) {
  return name.replace(/([A-Z])/g, "_$1").toLowerCase();
}

export function ObjKeysCamelFormat(data: Dictionary): Dictionary {
  if (typeof data !== "object" || !data) return data;
  if (Array.isArray(data)) return data.map((item) => ObjKeysCamelFormat(item));

  const newData: Dictionary = {};
  for (const key in data) {
    const newKey = snakeToCamel(key);
    newData[newKey] = ObjKeysCamelFormat(data[key]);
  }
  return newData;
}

export function ObjKeysSnakeFormat(data: Dictionary): Dictionary {
  if (typeof data !== "object" || !data) return data;
  if (Array.isArray(data)) return data.map((item) => ObjKeysSnakeFormat(item));

  const newData: Dictionary = {};
  for (const key in data) {
    const newKey = camelToSnake(key);
    newData[newKey] = ObjKeysSnakeFormat(data[key]);
  }
  return newData;
}
