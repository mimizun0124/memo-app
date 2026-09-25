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
 content: string; // HTML文字列として保存（リッチテキスト用）
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

 // 長押しメニュー用
 const [contextMenuMemo, setContextMenuMemo] = useState<MemoItem | null>(null);
 const pressTimer = useRef<NodeJS.Timeout | null>(null);

 const editorRef = useRef<HTMLDivElement>(null);

 // --- 初期化・自動保存 (localStorage) & 共有受け取り ---
 useEffect(() => {
 // データ読み込み
 const savedFolders = localStorage.getItem("smartnotes_folders");
 const savedMemos = localStorage.getItem("smartnotes_memos");
 
 if (savedFolders) setFolders(JSON.parse(savedFolders));
 else setFolders([{ id: "default", name: "すべてのメモ" }]);
 
 if (savedMemos) setMemos(JSON.parse(savedMemos));

 // Web Share Target API (PWA) からの受け取り処理
 // 例: ?title=共有タイトル&text=共有テキスト&url=https://...
 if (typeof window !== "undefined") {
 const params = new URLSearchParams(window.location.search);
 const sharedTitle = params.get("title");
 const sharedText = params.get("text");
 const sharedUrl = params.get("url");

 if (sharedTitle || sharedText || sharedUrl) {
 const newMemo: MemoItem = {
 id: Date.now().toString(),
 folderId: "default",
 title: sharedTitle || "共有されたメモ",
 content: `${sharedText || ""} <br> <a href="${sharedUrl}">${sharedUrl || ""}</a>`,
 isPinned: false,
 updatedAt: Date.now(),
 };
 setMemos((prev) => [newMemo, ...prev]);
 setActiveFolderId("default");
 setActiveMemoId(newMemo.id);
 setView("editor");
 
 // パラメータを消す（リロード時の重複防止）
 window.history.replaceState({}, document.title, window.location.pathname);
 }
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


 // --- メモ操作 ---
 const handleCreateMemo = () => {
 const newMemo: MemoItem = {
 id: Date.now().toString(),
 folderId: activeFolderId || "default",
 title: "",
 content: "",
 isPinned: false,
 updatedAt: Date.now(),
 };
 setMemos([newMemo, ...memos]);
 setActiveMemoId(newMemo.id);
 setView("editor");
 };

 const updateActiveMemo = (updates: Partial<MemoItem>) => {
 setMemos((prev) =>
 prev.map((m) => (m.id === activeMemoId ? { ...m, ...updates, updatedAt: Date.now() } : m))
 );
 };

 const deleteMemo = (id: string) => {
 setMemos(memos.filter((m) => m.id !== id));
 setContextMenuMemo(null);
 };

 const togglePin = (id: string) => {
 setMemos(memos.map((m) => (m.id === id ? { ...m, isPinned: !m.isPinned } : m)));
 setContextMenuMemo(null);
 };

 const moveMemoFolder = (memoId: string, newFolderId: string) => {
 setMemos(memos.map((m) => (m.id === memoId ? { ...m, folderId: newFolderId } : m)));
 setContextMenuMemo(null);
 };


 // --- 長押し検知 ---
 const handleTouchStart = (memo: MemoItem) => {
 pressTimer.current = setTimeout(() => {
 setContextMenuMemo(memo);
 }, 600); // 600ms長押しでメニュー表示
 };

 const handleTouchEnd = () => {
 if (pressTimer.current) clearTimeout(pressTimer.current);
 };


 // --- リッチテキスト操作 (選択した文字のみ変更) ---
 const applyFormat = (command: string, value?: string) => {
 document.execCommand(command, false, value);
 if (editorRef.current) {
 updateActiveMemo({ content: editorRef.current.innerHTML });
 }
 };

 // 文字サイズ変更 (HTMLの仕様上、spanタグを挿入して直接styleを当てる)
 const changeFontSize = (sizePx: string) => {
 const selection = window.getSelection();
 if (!selection || selection.rangeCount === 0) return;
 const span = document.createElement("span");
 span.style.fontSize = `${sizePx}px`;
 span.textContent = selection.toString();
 const range = selection.getRangeAt(0);
 range.deleteContents();
 range.insertNode(span);
 
 if (editorRef.current) updateActiveMemo({ content: editorRef.current.innerHTML });
 };

 // ページ区切りの挿入（紙のノートの次のページ）
 const insertPageBreak = () => {
 const hr = document.createElement("hr");
 hr.style.borderTop = "2px dashed #cbd5e1";
 hr.style.margin = "40px 0";
 hr.style.pageBreakAfter = "always";
 
 const selection = window.getSelection();
 if (selection && selection.rangeCount > 0) {
 const range = selection.getRangeAt(0);
 range.insertNode(hr);
 // 改行を後ろに入れる
 const br = document.createElement("br");
 range.insertNode(br);
 } else if (editorRef.current) {
 editorRef.current.appendChild(hr);
 }
 if (editorRef.current) updateActiveMemo({ content: editorRef.current.innerHTML });
 };

 // 上にスワイプでキーボードを閉じる処理
 let lastScrollY = 0;
 const handleEditorScroll = (e: React.UIEvent<HTMLDivElement>) => {
 const currentScrollY = e.currentTarget.scrollTop;
 // 上方向へのスクロール（スワイプ）を検知したらフォーカスを外す
 if (currentScrollY > lastScrollY + 20) {
 if (document.activeElement instanceof HTMLElement) {
 document.activeElement.blur();
 }
 }
 lastScrollY = currentScrollY;
 };


 // --- 描画ロジック ---
 const activeMemo = memos.find((m) => m.id === activeMemoId);
 const displayMemos = memos
 .filter((m) => (activeFolderId === "default" ? true : m.folderId === activeFolderId))
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
 onClick={() => { setActiveFolderId(folder.id); setView("list"); }}
 className="p-4 bg-white rounded-xl shadow-sm cursor-pointer flex justify-between items-center"
 >
 <span className="font-semibold text-lg flex items-center gap-2">
 {folder.name}
 </span>
 <span className="text-slate-400 text-sm">
 {memos.filter(m => folder.id === "default" ? true : m.folderId === folder.id).length}
 </span>
 </div>
 ))}
 <button
 onClick={() => {
 const name = prompt("新規フォルダ名:");
 if (name) setFolders([...folders, { id: Date.now().toString(), name }]);
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
 <div className="p-4 flex items-center gap-2 border-b border-slate-200 bg-white">
 <button onClick={() => setView("folders")} className="text-indigo-600 font-semibold p-2">
 ＜ フォルダ
 </button>
 <h1 className="text-xl font-bold flex-1 text-center truncate">
 {folders.find(f => f.id === activeFolderId)?.name}
 </h1>
 <div className="w-16"></div> {/* バランス調整用 */}
 </div>
 
 <div className="flex-1 overflow-y-auto p-4 space-y-2">
 {displayMemos.map((memo) => (
 <div
 key={memo.id}
 onClick={() => { setActiveMemoId(memo.id); setView("editor"); }}
 onTouchStart={() => handleTouchStart(memo)}
 onTouchEnd={handleTouchEnd}
 onMouseDown={() => handleTouchStart(memo)}
 onMouseUp={handleTouchEnd}
 onMouseLeave={handleTouchEnd}
 className="p-4 bg-white rounded-xl shadow-sm cursor-pointer"
 >
 <div className="font-bold text-lg truncate flex items-center gap-1">
 {memo.isPinned && " "} {memo.title || "無題のメモ"}
 </div>
 {/* HTMLタグを除去してプレビュー表示 */}
 <div className="text-slate-500 text-sm truncate mt-1">
 {memo.content.replace(/<[^>]*>?/gm, '') || "追加テキストなし"}
 </div>
 <div className="text-xs text-slate-400 mt-2">
 {new Date(memo.updatedAt).toLocaleDateString()}
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

 {/* 長押しコンテキストメニュー */}
 {contextMenuMemo && (
 <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
 <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
 <div className="p-4 border-b font-bold text-center">メモの操作</div>
 <button onClick={() => togglePin(contextMenuMemo.id)} className="w-full p-4 text-left border-b active:bg-slate-100">
 {contextMenuMemo.isPinned ? "ピン留めを解除" : " ピン留めする"}
 </button>
 <button onClick={() => {
 const targetFolder = prompt("移動先のフォルダIDを入力してください（簡易実装）", "default");
 if (targetFolder) moveMemoFolder(contextMenuMemo.id, targetFolder);
 }} className="w-full p-4 text-left border-b active:bg-slate-100">
 フォルダを移動
 </button>
 <button onClick={() => deleteMemo(contextMenuMemo.id)} className="w-full p-4 text-left text-red-600 active:bg-red-50">
 削除
 </button>
 <button onClick={() => setContextMenuMemo(null)} className="w-full p-4 text-center font-bold text-slate-500 bg-slate-100">
 キャンセル
 </button>
 </div>
 </div>
 )}
 </div>
 )}

 {/* 3. エディタ画面 (全画面表示) */}
 {view === "editor" && activeMemo && (
 <div className="flex-1 flex flex-col w-full bg-white">
 {/* ヘッダー */}
 <div className="flex items-center justify-between p-3 border-b border-slate-100">
 <button onClick={() => setView("list")} className="text-indigo-600 font-semibold p-2">
 ＜ 戻る
 </button>
 
 {/* 装飾ツールバー（選択した文字だけ適用される） */}
 <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 px-2 overflow-x-auto">
 <input 
 type="color" 
 onChange={(e) => applyFormat("foreColor", e.target.value)} 
 className="w-6 h-6 rounded cursor-pointer border-none bg-transparent"
 title="文字色"
 />
 <div className="w-px h-4 bg-slate-300"></div>
 {/* 細かい文字サイズ (8px〜26px) */}
 <select 
 onChange={(e) => changeFontSize(e.target.value)}
 className="bg-transparent text-sm font-semibold outline-none"
 >
 <option value="">サイズ</option>
 {[8, 10, 12, 14, 16, 18, 20, 22, 24, 26].map(s => (
 <option key={s} value={s}>{s}px</option>
 ))}
 </select>
 <div className="w-px h-4 bg-slate-300"></div>
 <button onClick={() => applyFormat("bold")} className="font-bold px-2">B</button>
 <button onClick={insertPageBreak} className="text-xs px-2 whitespace-nowrap bg-white rounded shadow-sm">
 次のページ
 </button>
 </div>
 </div>

 {/* 編集エリア */}
 <div 
 className="flex-1 overflow-y-auto p-6"
 onScroll={handleEditorScroll}
 >
 <input
 type="text"
 value={activeMemo.title}
 onChange={(e) => updateActiveMemo({ title: e.target.value })}
 placeholder="タイトル"
 className="text-3xl font-bold w-full outline-none mb-4"
 />
 <div
 ref={editorRef}
 contentEditable
 suppressContentEditableWarning
 onBlur={(e) => updateActiveMemo({ content: e.currentTarget.innerHTML })}
 className="w-full min-h-[50vh] outline-none leading-relaxed text-lg"
 dangerouslySetInnerHTML={{ __html: activeMemo.content }}
 />
 </div>
 </div>
 )}
 </div>
 );
}