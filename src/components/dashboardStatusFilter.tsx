import { Segmented, Select } from "antd";
import { TASK_STATUS_ORDER } from "../dashboardTaskState";
import type { Locale, StatusFilterValue, StatusLabelMap } from "../dashboardTypes";

type StatusFilterBarProps = {
  locale: Locale;
  value: StatusFilterValue;
  onChange: (next: StatusFilterValue) => void;
  statusFilterAll: StatusFilterValue;
  statusLabel: StatusLabelMap;
};


export function StatusFilterBar({
  locale,
  value,
  onChange,
  statusFilterAll,
  statusLabel,
}: StatusFilterBarProps) {
  return (
    <div className="status-filter">
      <Select
        value={value}
        onChange={(next) => onChange(next as StatusFilterValue)}
        options={[
          { label: locale === "zh-CN" ? "全部状态" : "All statuses", value: statusFilterAll },
          ...TASK_STATUS_ORDER.map((status) => ({
            label: statusLabel[status][locale],
            value: status,
          })),
        ]}
        className="status-filter-select"
      />
    </div>
  );
}
