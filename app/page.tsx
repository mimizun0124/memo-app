"use client";

import React, { useState, useEffect, useRef } from "react";

// --- 型定義 ---
interface Folder {
id: string;
name: string;
}

interface MemoItem {
id: string;
folderId: string | null;
title: string;
pages: string[]; // ページ分割用の配列（各要素が1ページ分のHTML文字列）
isPinned: boolean;
updatedAt: number;
}

export default function MemoApp() {
// --- 状態管理 ---
const [folders, setFolders] = useState<Folder[]>([]);
const [memos, setMemos] = useState<MemoItem[]>([]);

// 画面遷移状態: 'folders' (フォルダ一覧) -> 'list' (メモ一覧) -> 'editor' (編集画面)
const [view, setView] = useState<"folders" | "list" | "editor">("folders");
const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
const [activeMemoId, setActiveMemoId] = useState<string | null>(null);

// ページ分割・検索用状態
const [activePageIndex, setActivePageIndex] = useState<number>(0);
const [searchQuery, setSearchQuery] = useState("");

const editorRef = useRef<HTMLDivElement>(null);

// --- 初期化・自動保存 (localStorage) ---
useEffect(() => {
// データ読み込み
const savedFolders = localStorage.getItem("smartnotes_folders");
const savedMemos = localStorage.getItem("smartnotes_memos");

if (savedFolders) {
setFolders(JSON.parse(savedFolders));
} else {
setFolders([{ id: "default", name: "すべてのメモ" }]);
}

if (savedMemos) {
const parsedMemos = JSON.parse(savedMemos);
// 旧データの互換性維持（contentの文字列をpagesの配列に変換）
const migratedMemos = parsedMemos.map((m: any) => ({
...m,
pages: m.pages || [m.content || ""]
}));
setMemos(migratedMemos);
}
}, []);

// memos, foldersが更新されたら自動保存
useEffect(() => {
if (folders.length > 0) {
localStorage.setItem("smartnotes_folders", JSON.stringify(folders));
}
}, [folders]);

useEffect(() => {
if (memos.length > 0) {
localStorage.setItem("smartnotes_memos", JSON.stringify(memos));
}
}, [memos]);


// --- メモ・フォルダ操作 ---
const handleCreateMemo = () => {
const newMemo: MemoItem = {
id: Date.now().toString(),
folderId: activeFolderId || "default",
title: "",
pages: [""],
isPinned: false,
updatedAt: Date.now(),
};
setMemos([newMemo, ...memos]);
setActiveMemoId(newMemo.id);
setActivePageIndex(0);
setView("editor");
};

const updateActiveMemo = (updates: Partial<MemoItem>) => {
setMemos((prev) =>
prev.map((m) => (m.id === activeMemoId ? { ...m, ...updates, updatedAt: Date.now() } : m))
);
};

const updateActivePageContent = (newContent: string) => {
setMemos((prev) =>
prev.map((m) => {
if (m.id === activeMemoId) {
const newPages = [...m.pages];
newPages[activePageIndex] = newContent;
return { ...m, pages: newPages, updatedAt: Date.now() };
}
return m;
})
);
};

const handleDeleteFolder = (folderId: string, e: React.MouseEvent) => {
e.stopPropagation();
if (folderId === "default") return; // デフォルトは削除不可
if (window.confirm("このフォルダを削除しますか？\n（中のメモは「すべてのメモ」に移動します）")) {
setFolders(prev => prev.filter(f => f.id !== folderId));
// 削除されたフォルダ内のメモを「すべてのメモ」に移動
setMemos(prev => prev.map(m => m.folderId === folderId ? { ...m, folderId: "default" } : m));
if (activeFolderId === folderId) {
setActiveFolderId("default");
}
}
};


// --- ページ操作 ---
const handleAddPage = () => {
setMemos((prev) =>
prev.map((m) => {
if (m.id === activeMemoId) {
const newPages = [...m.pages, ""];
return { ...m, pages: newPages, updatedAt: Date.now() };
}
return m;
})
);
// 新しいページを開くためにインデックスを進める
setActivePageIndex(activeMemo ? activeMemo.pages.length : 0);
};

const handleDeleteCurrentPage = () => {
if (!activeMemo) return;
if (activeMemo.pages.length <= 1) {
alert("最後のページは削除できません。内容を消去したい場合はテキストを削除してください。");
return;
}
if (window.confirm(`ページ ${activePageIndex + 1} を削除しますか？`)) {
setMemos((prev) =>
prev.map((m) => {
if (m.id === activeMemoId) {
const newPages = m.pages.filter((_, idx) => idx !== activePageIndex);
return { ...m, pages: newPages, updatedAt: Date.now() };
}
return m;
})
);
// 削除後、前のページに戻る（0ページ目を消した場合は0のまま）
setActivePageIndex(prev => (prev > 0 ? prev - 1 : 0));
}
};


// --- リッチテキスト操作 (選択した文字のみ変更) ---
const applyFormat = (command: string, value?: string) => {
document.execCommand(command, false, value);
if (editorRef.current) {
updateActivePageContent(editorRef.current.innerHTML);
}
};

// 文字サイズ変更
const changeFontSize = (sizePx: string) => {
const selection = window.getSelection();
if (!selection || selection.rangeCount === 0) return;
const span = document.createElement("span");
span.style.fontSize = `${sizePx}px`;
span.textContent = selection.toString();
const range = selection.getRangeAt(0);
range.deleteContents();
range.insertNode(span);

if (editorRef.current) {
updateActivePageContent(editorRef.current.innerHTML);
}
};


// --- 描画ロジック ---
const activeMemo = memos.find((m) => m.id === activeMemoId);
const displayMemos = memos
.filter((m) => (activeFolderId === "default" ? true : m.folderId === activeFolderId))
.filter((m) => {
// 検索機能のフィルタリング
if (!searchQuery) return true;
const q = searchQuery.toLowerCase();
const titleMatch = m.title.toLowerCase().includes(q);
const contentMatch = m.pages.some(p => p.toLowerCase().includes(q));
return titleMatch || contentMatch;
})
.sort((a, b) => {
if (a.isPinned === b.isPinned) return b.updatedAt - a.updatedAt;
return a.isPinned ? -1 : 1;
});

return (
<div className="flex h-screen w-screen overflow-hidden bg-white text-slate-800 font-sans select-none">

{/* 1. フォルダ一覧画面 */}
{view === "folders" && (
<div className="flex-1 flex flex-col w-full bg-slate-50">
<div className="p-6 pb-2 border-b border-slate-200">
<h1 className="text-3xl font-bold">フォルダ</h1>
</div>
<div className="flex-1 overflow-y-auto p-4 space-y-2">
{folders.map((folder) => (
<div
key={folder.id}
onClick={() => { setActiveFolderId(folder.id); setView("list"); setSearchQuery(""); }}
className="p-4 bg-white rounded-xl shadow-sm cursor-pointer flex justify-between items-center group"
>
<span className="font-semibold text-lg flex items-center gap-2">
{folder.name}
</span>
<div className="flex items-center gap-4">
<span className="text-slate-400 text-sm">
{memos.filter(m => folder.id === "default" ? true : m.folderId === folder.id).length}
</span>
{/* 削除ボタン (デフォルトフォルダ以外) */}
{folder.id !== "default" && (
<button
onClick={(e) => handleDeleteFolder(folder.id, e)}
className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600 font-semibold text-sm"
>
削除
</button>
)}
</div>
</div>
))}
<button
onClick={() => {
const name = prompt("新規フォルダ名:");
if (name && name.trim()) setFolders([...folders, { id: Date.now().toString(), name: name.trim() }]);
}}
className="mt-4 text-indigo-600 font-semibold p-2"
>
＋ 新規フォルダ作成
</button>
</div>
</div>
)}

{/* 2. メモ一覧画面 */}
{view === "list" && (
<div className="flex-1 flex flex-col w-full bg-slate-50 relative">
<div className="p-4 flex flex-col gap-3 border-b border-slate-200 bg-white">
<div className="flex items-center gap-2">
<button onClick={() => setView("folders")} className="text-indigo-600 font-semibold p-2">
＜ フォルダ
</button>
<h1 className="text-xl font-bold flex-1 text-center truncate">
{folders.find(f => f.id === activeFolderId)?.name}
</h1>
<div className="w-16"></div> {/* バランス調整用 */}
</div>
{/* 検索バー */}
<input
type="text"
placeholder="タイトルや内容で検索..."
value={searchQuery}
onChange={(e) => setSearchQuery(e.target.value)}
className="w-full bg-slate-100 text-slate-700 px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
/>
</div>

<div className="flex-1 overflow-y-auto p-4 space-y-2">
{displayMemos.length === 0 && (
<div className="text-center text-slate-400 mt-10">メモがありません</div>
)}
{displayMemos.map((memo) => (
<div
key={memo.id}
onClick={() => { setActiveMemoId(memo.id); setActivePageIndex(0); setView("editor"); }}
className="p-4 bg-white rounded-xl shadow-sm cursor-pointer"
>
<div className="font-bold text-lg truncate flex items-center gap-1">
{memo.isPinned && "📌"} {memo.title || "無題のメモ"}
</div>
{/* HTMLタグを除去してプレビュー表示 (全ページのテキストを連結) */}
<div className="text-slate-500 text-sm truncate mt-1">
{memo.pages.join(" ").replace(/<[^>]*>?/gm, '') || "追加テキストなし"}
</div>
<div className="flex justify-between items-center mt-2">
<div className="text-xs text-slate-400">
{new Date(memo.updatedAt).toLocaleDateString()}
</div>
<div className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
全 {memo.pages.length} ページ
</div>
</div>
</div>
))}
</div>

{/* 新規作成ボタン (右下フローティング) */}
<button
onClick={handleCreateMemo}
className="absolute bottom-8 right-8 w-14 h-14 bg-indigo-600 rounded-full shadow-lg flex items-center justify-center text-white text-3xl pb-1"
>
＋
</button>
</div>
)}

{/* 3. エディタ画面 (全画面表示) */}
{view === "editor" && activeMemo && (
<div className="flex-1 flex flex-col w-full bg-white">
{/* ヘッダー */}
<div className="flex flex-col border-b border-slate-100">
<div className="flex items-center justify-between p-3">
<button onClick={() => setView("list")} className="text-indigo-600 font-semibold p-2">
＜ 戻る
</button>

{/* フォルダ移動用セレクトボックス */}
<div className="flex items-center text-sm font-medium text-slate-500 gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
📂 移動先:
<select
value={activeMemo.folderId || "default"}
onChange={(e) => updateActiveMemo({ folderId: e.target.value })}
className="bg-transparent font-bold outline-none cursor-pointer max-w-[120px] truncate text-slate-700"
>
{folders.map(f => (
<option key={f.id} value={f.id}>{f.name}</option>
))}
</select>
</div>
</div>

{/* 装飾ツールバー ＆ ページ切り替え */}
<div className="flex items-center justify-between px-3 pb-3">
<div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 px-2 overflow-x-auto">
<input
type="color"
onChange={(e) => applyFormat("foreColor", e.target.value)}
className="w-6 h-6 rounded cursor-pointer border-none bg-transparent"
title="文字色"
/>
<div className="w-px h-4 bg-slate-300"></div>
<select
onChange={(e) => changeFontSize(e.target.value)}
className="bg-transparent text-sm font-semibold outline-none cursor-pointer"
defaultValue=""
>
<option value="" disabled>サイズ</option>
{[8, 10, 12, 14, 16, 18, 20, 22, 24, 26].map(s => (
<option key={s} value={s}>{s}px</option>
))}
</select>
<div className="w-px h-4 bg-slate-300"></div>
<button onClick={() => applyFormat("bold")} className="font-bold px-3 hover:text-indigo-600 transition-colors">B</button>
</div>

{/* ページめくりコントロール */}
<div className="flex items-center gap-2 bg-indigo-50 rounded-lg p-1 border border-indigo-100">
<button
disabled={activePageIndex === 0}
onClick={() => setActivePageIndex(p => p - 1)}
className="px-3 py-1 bg-white rounded shadow-sm text-indigo-600 disabled:opacity-30 disabled:shadow-none font-bold"
>
◀
</button>
<span className="text-sm font-bold w-12 text-center text-indigo-800">
{activePageIndex + 1} / {activeMemo.pages.length}
</span>
<button
disabled={activePageIndex === activeMemo.pages.length - 1}
onClick={() => setActivePageIndex(p => p + 1)}
className="px-3 py-1 bg-white rounded shadow-sm text-indigo-600 disabled:opacity-30 disabled:shadow-none font-bold"
>
▶
</button>
</div>
</div>
</div>

{/* 編集エリア */}
<div className="flex-1 overflow-y-auto p-6 flex flex-col">
<input
type="text"
value={activeMemo.title}
onChange={(e) => updateActiveMemo({ title: e.target.value })}
placeholder="タイトル"
className="text-3xl font-bold w-full outline-none mb-6 border-b border-transparent focus:border-slate-200 pb-2 transition-colors"
/>
<div
key={`${activeMemo.id}-page-${activePageIndex}`} // ページ切り替え時にDOMを再構築して入力をリセット
ref={editorRef}
contentEditable
suppressContentEditableWarning
onBlur={(e) => updateActivePageContent(e.currentTarget.innerHTML)}
className="w-full flex-1 outline-none leading-relaxed text-lg pb-20"
dangerouslySetInnerHTML={{ __html: activeMemo.pages[activePageIndex] || "" }}
/>
</div>

{/* ページ追加・削除フッター */}
<div className="border-t border-slate-100 p-3 flex justify-between items-center bg-white">
<button
onClick={handleDeleteCurrentPage}
className="text-red-400 hover:text-red-600 font-semibold px-2 py-2 text-sm transition-colors"
>
このページを削除
</button>
<button
onClick={handleAddPage}
className="bg-indigo-600 text-white hover:bg-indigo-700 font-bold px-4 py-2 rounded-lg shadow-sm transition-colors text-sm"
>
＋ 次のページを追加
</button>
</div>
</div>
)}
</div>
);
}
