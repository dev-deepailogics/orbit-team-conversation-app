import React from 'react';

// Orbit icon set (Figma "Redesign v2"). Each SVG in /public/icons is drawn through a CSS mask
// filled with currentColor, so icons follow text color and therefore the active theme.
// Lucide names without a Figma counterpart fall through to lucide-react unchanged.
export * from 'lucide-react';

export interface OrbitIconProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'> {
  size?: number | string;
  color?: string;
  // Accepted for lucide compatibility; the Figma artwork has fixed stroke weights.
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
  fill?: string;
}

// Size travels as a CSS variable read by .orbit-icon in the base layer, so utility classes
// like `w-4 h-4` still win over the `size` prop, matching how lucide's SVG attributes behave.
const sizeVar = (size?: number | string) =>
  (size === undefined ? {} : { '--icon-size': typeof size === 'number' ? `${size}px` : size }) as React.CSSProperties;

function orbitIcon(file: string, displayName: string) {
  const mask = `url(/icons/${file}.svg) center / contain no-repeat`;
  const Icon = React.forwardRef<HTMLSpanElement, OrbitIconProps>(
    ({ size, color, className, style, strokeWidth: _sw, absoluteStrokeWidth: _asw, fill: _fill, ...rest }, ref) => (
      <span
        ref={ref}
        aria-hidden={rest['aria-label'] ? undefined : true}
        role={rest['aria-label'] ? 'img' : undefined}
        {...rest}
        className={`orbit-icon ${className ?? ''}`}
        style={{
          ...sizeVar(size),
          backgroundColor: color ?? 'currentColor',
          WebkitMask: mask,
          mask,
          ...style,
        }}
      />
    ),
  );
  Icon.displayName = displayName;
  return Icon;
}

// Figma-only names
export const Canvas = orbitIcon('canvas', 'Canvas');
export const Space = orbitIcon('space', 'Space');
export const Board = orbitIcon('board', 'Board');
export const Thread = orbitIcon('thread', 'Thread');
export const Threads = orbitIcon('threads', 'Threads');
export const Bookmark = orbitIcon('bookmark', 'Bookmark');
export const Summary = orbitIcon('summary', 'Summary');
export const Pen = orbitIcon('pen', 'Pen');
export const More = orbitIcon('more', 'More');
export const Mask = orbitIcon('mask', 'Mask');
export const PriorityUp = orbitIcon('up', 'PriorityUp');
export const PriorityMedium = orbitIcon('eq', 'PriorityMedium');
export const PriorityDown = orbitIcon('down', 'PriorityDown');
export const SortDown = orbitIcon('sort', 'SortDown');
export const Pinwheel = (() => {
  const mask = 'url(/brand/pinwheel.svg) center / contain no-repeat';
  const P = React.forwardRef<HTMLSpanElement, OrbitIconProps>(
    ({ size = 34, color, className, style, strokeWidth: _sw, absoluteStrokeWidth: _asw, fill: _fill, ...rest }, ref) => (
      <span
        ref={ref}
        role="img"
        aria-label="Orbit"
        {...rest}
        className={`orbit-icon ${className ?? ''}`}
        style={{ ...sizeVar(size), backgroundColor: color ?? 'var(--theme-accent)', WebkitMask: mask, mask, ...style }}
      />
    ),
  );
  P.displayName = 'Pinwheel';
  return P;
})();

// Lucide names replaced by their Figma counterpart
export const X = orbitIcon('x', 'X');
export const Check = orbitIcon('check', 'Check');
export const Search = orbitIcon('search', 'Search');
export const Plus = orbitIcon('plus', 'Plus');
export const Minus = orbitIcon('minus', 'Minus');
export const Clock = orbitIcon('clock', 'Clock');
export const Trash2 = orbitIcon('trash', 'Trash2');
export const FileText = orbitIcon('docs', 'FileText');
export const User = orbitIcon('user', 'User');
export const Users = orbitIcon('users', 'Users');
export const Calendar = orbitIcon('cal', 'Calendar');
export const Shield = orbitIcon('shield', 'Shield');
export const MessageSquare = orbitIcon('msg', 'MessageSquare');
export const Lock = orbitIcon('lock', 'Lock');
export const ChevronDown = orbitIcon('chevron-down', 'ChevronDown');
export const ChevronRight = orbitIcon('chevron-right', 'ChevronRight');
export const ChevronLeft = orbitIcon('back', 'ChevronLeft');
export const Copy = orbitIcon('copy', 'Copy');
export const RefreshCw = orbitIcon('refresh', 'RefreshCw');
export const RotateCcw = orbitIcon('reset', 'RotateCcw');
export const Undo2 = orbitIcon('undo', 'Undo2');
export const Hash = orbitIcon('hash', 'Hash');
export const HardDrive = orbitIcon('drive', 'HardDrive');
export const AlertTriangle = orbitIcon('alert', 'AlertTriangle');
export const Info = orbitIcon('info', 'Info');
export const HelpCircle = orbitIcon('help', 'HelpCircle');
export const LogOut = orbitIcon('logout', 'LogOut');
export const Eye = orbitIcon('eye', 'Eye');
export const Smile = orbitIcon('smile', 'Smile');
export const SmilePlus = orbitIcon('smile', 'SmilePlus');
export const Mail = orbitIcon('mail', 'Mail');
export const Coffee = orbitIcon('coffee', 'Coffee');
export const Paperclip = orbitIcon('clip', 'Paperclip');
export const Send = orbitIcon('send', 'Send');
export const Share2 = orbitIcon('share', 'Share2');
export const Pencil = orbitIcon('pencil', 'Pencil');
export const Edit = orbitIcon('pencil', 'Edit');
export const Edit2 = orbitIcon('pencil', 'Edit2');
export const Edit3 = orbitIcon('pencil', 'Edit3');
export const PhoneCall = orbitIcon('phone', 'PhoneCall');
export const Tag = orbitIcon('tag', 'Tag');
export const FolderKanban = orbitIcon('board', 'FolderKanban');
export const Trello = orbitIcon('board', 'Trello');
export const Columns3 = orbitIcon('board', 'Columns3');
export const Home = orbitIcon('home', 'Home');
export const Bell = orbitIcon('bell', 'Bell');
export const Bot = orbitIcon('bot', 'Bot');
export const Code = orbitIcon('code', 'Code');
export const Type = orbitIcon('type', 'Type');
export const Image = orbitIcon('img', 'Image');
export const Quote = orbitIcon('quote', 'Quote');
export const List = orbitIcon('list', 'List');
export const ListOrdered = orbitIcon('olist', 'ListOrdered');
export const Palette = orbitIcon('palette', 'Palette');
export const Pin = orbitIcon('pin', 'Pin');
export const Link = orbitIcon('link', 'Link');
export const Link2 = orbitIcon('link', 'Link2');
export const Globe = orbitIcon('globe', 'Globe');
export const Settings = orbitIcon('gear', 'Settings');
export const AtSign = orbitIcon('at', 'AtSign');
export const Heart = orbitIcon('heart', 'Heart');
export const Filter = orbitIcon('filter', 'Filter');
export const Flag = orbitIcon('flag', 'Flag');
export const MousePointer = orbitIcon('cursor', 'MousePointer');
export const StickyNote = orbitIcon('note', 'StickyNote');
export const KeyRound = orbitIcon('key', 'KeyRound');
export const Square = orbitIcon('shape', 'Square');
export const StatusReview = orbitIcon('status-rev', 'StatusReview');
export const StatusProgress = orbitIcon('status-prog', 'StatusProgress');
export const StatusTodo = orbitIcon('status-todo', 'StatusTodo');
export const Connector = orbitIcon('conn', 'Connector');
