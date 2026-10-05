import { useState } from 'react';
import { ChevronDown, ChevronUp, Footprints, Move, Wrench, ZoomIn } from 'lucide-react';

const HINTS = [
  { Icon: Move, text: '滑鼠拖曳：環顧四周' },
  { Icon: ZoomIn, text: '滾輪：拉近／拉遠' },
  { Icon: Footprints, text: '點擊地面光點：移動到下個坑道區段' },
  { Icon: Wrench, text: '點擊坑道設備：查看詳細資料' },
];

export default function ControlHintHUD() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="control-hint-hud-wrap">
      <button className="control-hint-toggle" onClick={() => setCollapsed((v) => !v)}>
        <span>💡 操作說明</span>
        {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>

      {!collapsed && (
        <div className="control-hint-hud">
          {HINTS.map(({ Icon, text }) => (
            <div key={text} className="control-hint-row">
              <Icon size={14} />
              <span>{text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
