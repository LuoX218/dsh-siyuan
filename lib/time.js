/** 日期与标题格式：纯函数，无副作用。 */

function dayKey(date) {
  const d = date instanceof Date ? date : new Date();
  const p = (n) => String(n).padStart(2, "0");
  return String(d.getFullYear()) + p(d.getMonth() + 1) + p(d.getDate());
}

/** 按配置的格式产出日期文本。 */
function dayStamp(date, format) {
  const d = date instanceof Date ? date : new Date();
  const p = (n) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = p(d.getMonth() + 1);
  const day = p(d.getDate());
  if (format === "slash") return y + "/" + m + "/" + day;
  if (format === "cn") return y + "年" + Number(m) + "月" + Number(day) + "日";
  return y + "-" + m + "-" + day;
}

/**
 * 把标题模板里的占位符替换掉。
 * 支持的变量：{date} {time} {title}
 */
function renderTitle(template, date, extraTitle) {
  const d = date instanceof Date ? date : new Date();
  const stamp = dayStamp(d, "dash");
  const time = fullStamp(d).replace(/:/g, "");
  return String(template)
    .replace(/\{date\}/g, stamp)
    .replace(/\{time\}/g, time)
    .replace(/\{title\}/g, extraTitle ?? "")
    .replace(/\s+/g, " ")
    .trim() || stamp;
}

/** 时分秒标签，用于每段内容的小标题。 */
function fullStamp(date) {
  const d = date instanceof Date ? date : new Date();
  const p = (n) => String(n).padStart(2, "0");
  return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
}


export { dayKey, dayStamp, renderTitle, fullStamp };
