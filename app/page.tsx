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
 pages: string[];
 isPinned: boolean;
 updatedAt: number;
}

export default function MemoApp() {
 // --- 状態管理 ---
 const [folders, setFolders] = useState<Folder[]>([]);
 const [memos, setMemos] = useState<MemoItem[]>([]);

 // サイドパネルの開閉状態
 const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

 // 左パネルの表示状態: 'folders' (フォルダ一覧) -> 'list' (メモ一覧)
 const [leftView, setLeftView] = useState<"folders" | "list">("folders");
 const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
 const [activeMemoId, setActiveMemoId] = useState<string | null>(null);

 // ページ分割・検索用状態
 const [activePageIndex, setActivePageIndex] = useState<number>(0);
 const [searchQuery, setSearchQuery] = useState("");

 // 長押し・メニュー用状態
 const [menuTargetMemoId, setMenuTargetMemoId] = useState<string | null>(null);
 const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
 const isLongPress = useRef<boolean>(false);

 const editorRef = useRef<HTMLDivElement>(null);

 // --- 初期化・自動保存 (localStorage) ---
 useEffect(() => {
 const savedFolders = localStorage.getItem("smartnotes_folders");
 const savedMemos = localStorage.getItem("smartnotes_memos");

 if (savedFolders) {
 setFolders(JSON.parse(savedFolders));
 } else {
 setFolders([{ id: "default", name: "すべてのメモ" }]);
 }

 if (savedMemos) {
 const parsedMemos = JSON.parse(savedMemos);
 const migratedMemos = parsedMemos.map((m: any) => ({
 ...m,
 pages: m.pages || [m.content || ""]
 }));
 setMemos(migratedMemos);
 }
 }, []);

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
 setIsSidebarOpen(true);
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
 if (folderId === "default") return;
 if (window.confirm("このフォルダを削除しますか？\n（中のメモは「すべてのメモ」に移動します）")) {
 setFolders(prev => prev.filter(f => f.id !== folderId));
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
 setActivePageIndex(prev => (prev > 0 ? prev - 1 : 0));
 }
 };

 // --- 長押し・メニュー操作 ---
 const handlePressStart = (memoId: string) => {
 isLongPress.current = false;
 longPressTimer.current = setTimeout(() => {
 setMenuTargetMemoId(memoId);
 isLongPress.current = true;
 }, 600); // 600msで長押し判定
 };

 const handlePressEndOrCancel = () => {
 if (longPressTimer.current) {
 clearTimeout(longPressTimer.current);
 longPressTimer.current = null;
 }
 };

 const handleTogglePin = (memoId: string) => {
 setMemos((prev) =>
 prev.map((m) => (m.id === memoId ? { ...m, isPinned: !m.isPinned } : m))
 );
 setMenuTargetMemoId(null);
 };

 const handleDeleteMemo = (memoId: string) => {
 if (window.confirm("このメモを削除しますか？")) {
 setMemos((prev) => prev.filter((m) => m.id !== memoId));
 if (activeMemoId === memoId) {
 setActiveMemoId(null);
 setActivePageIndex(0);
 }
 }
 setMenuTargetMemoId(null);
 };

 // --- リッチテキスト操作 ---
 const applyFormat = (command: string, value?: string) => {
 document.execCommand(command, false, value);
 if (editorRef.current) {
 updateActivePageContent(editorRef.current.innerHTML);
 }
 };

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
 
 {/* ＝＝＝ 左側ペイン (30%) ＝＝＝ */}
 {isSidebarOpen && (
 <div className="w-[30%] min-w-[280px] max-w-[400px] border-r border-slate-200 flex flex-col bg-slate-50 relative transition-all duration-300 ease-in-out">
 
 {/* 左ペイン：フォルダ一覧表示 */}
 {leftView === "folders" && (
 <>
 <div className="p-6 pb-2 border-b border-slate-200 flex justify-between items-center">
 <h1 className="text-2xl font-bold">フォルダ</h1>
 </div>
 <div className="flex-1 overflow-y-auto p-4 space-y-2">
 {folders.map((folder) => (
 <div
 key={folder.id}
 onClick={() => { setActiveFolderId(folder.id); setLeftView("list"); setSearchQuery(""); }}
 className="p-4 bg-white rounded-xl shadow-sm cursor-pointer flex justify-between items-center group transition-colors hover:bg-slate-50"
 >
 <span className="font-semibold flex items-center gap-2">
 {folder.name}
 </span>
 <div className="flex items-center gap-4">
 <span className="text-slate-400 text-sm">
 {memos.filter(m => folder.id === "default" ? true : m.folderId === folder.id).length}
 </span>
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
 className="mt-4 text-indigo-600 font-semibold p-2 hover:bg-indigo-50 rounded-lg w-full text-left transition-colors"
 >
 ＋ 新規フォルダ作成
 </button>
 </div>
 </>
 )}

 {/* 左ペイン：メモ一覧表示 */}
 {leftView === "list" && (
 <>
 <div className="p-4 flex flex-col gap-3 border-b border-slate-200 bg-white">
 <div className="flex items-center justify-between gap-2">
 <button onClick={() => setLeftView("folders")} className="text-indigo-600 font-semibold py-1 pr-2 hover:opacity-70">
 ＜ 戻る
 </button>
 <h1 className="text-lg font-bold flex-1 text-center truncate">
 {folders.find(f => f.id === activeFolderId)?.name}
 </h1>
 <div className="w-12"></div>
 </div>
 <input
 type="text"
 placeholder="検索..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full bg-slate-100 text-slate-700 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-300 transition-all text-sm"
 />
 </div>
 
 <div className="flex-1 overflow-y-auto p-3 space-y-2 relative">
 {displayMemos.length === 0 && (
 <div className="text-center text-slate-400 mt-10 text-sm">メモがありません</div>
 )}
 {displayMemos.map((memo) => (
 <div
 key={memo.id}
 // --- イベントハンドラの追加 ---
 onMouseDown={() => handlePressStart(memo.id)}
 onMouseUp={handlePressEndOrCancel}
 onMouseLeave={handlePressEndOrCancel}
 onTouchStart={() => handlePressStart(memo.id)}
 onTouchEnd={handlePressEndOrCancel}
 onTouchMove={handlePressEndOrCancel}
 onContextMenu={(e) => {
 e.preventDefault(); // PCの右クリックメニューを無効化
 setMenuTargetMemoId(memo.id);
 }}
 onClick={() => {
 if (isLongPress.current) {
 isLongPress.current = false;
 return; // 長押し直後のクリックイベントをキャンセル
 }
 setActiveMemoId(memo.id);
 setActivePageIndex(0);
 }}
 className={`p-3 rounded-xl shadow-sm cursor-pointer border ${
 activeMemoId === memo.id ? "bg-indigo-50 border-indigo-200" : "bg-white border-transparent hover:border-slate-200"
 }`}
 >
 <div className="font-bold text-base truncate flex items-center gap-1">
 {memo.isPinned && " "} {memo.title || "無題のメモ"}
 </div>
 <div className="text-slate-500 text-xs truncate mt-1">
 {memo.pages.join(" ").replace(/<[^>]*>?/gm, '') || "追加テキストなし"}
 </div>
 <div className="flex justify-between items-center mt-2">
 <div className="text-xs text-slate-400">
 {new Date(memo.updatedAt).toLocaleDateString()}
 </div>
 </div>
 </div>
 ))}
 </div>

 <button
 onClick={handleCreateMemo}
 className="absolute bottom-6 right-6 w-12 h-12 bg-indigo-600 hover:bg-indigo-700 transition-colors rounded-full shadow-lg flex items-center justify-center text-white text-2xl pb-1"
 >
 ＋
 </button>
 </>
 )}
 </div>
 )}

 {/* ＝＝＝ 右側ペイン (70% or 100%) ＝＝＝ */}
 <div className="flex-1 flex flex-col bg-white relative transition-all duration-300">
 
 {/* メモ未選択時のトップボタン (エディタがない画面用) */}
 {!activeMemo && (
 <div className="absolute top-4 left-4 z-10">
 <button
 onClick={() => setIsSidebarOpen(!isSidebarOpen)}
 className="p-2 bg-white hover:bg-slate-100 rounded-lg shadow-sm border border-slate-200 text-slate-600 font-bold text-sm transition-colors flex items-center gap-2"
 >
 {isSidebarOpen ? " リストを閉じる" : " リストを開く"}
 </button>
 </div>
 )}

 {activeMemo ? (
 <>
 {/* エディタヘッダー */}
 <div className="flex flex-col border-b border-slate-100">
 <div className="flex items-center justify-between p-3">
 <button
 onClick={() => setIsSidebarOpen(!isSidebarOpen)}
 className="p-1.5 px-3 bg-white hover:bg-slate-100 rounded-lg shadow-sm border border-slate-200 text-slate-600 font-bold text-sm transition-colors flex items-center gap-2"
 >
 {isSidebarOpen ? " 閉じる" : " 開く"}
 </button>

 <div className="flex items-center text-sm font-medium text-slate-500 gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
 移動先:
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

 <div className="flex items-center gap-2 bg-indigo-50 rounded-lg p-1 border border-indigo-100">
 <button 
 disabled={activePageIndex === 0} 
 onClick={() => setActivePageIndex(p => p - 1)}
 className="px-3 py-1 bg-white rounded shadow-sm text-indigo-600 disabled:opacity-30 disabled:shadow-none font-bold"
 >
 
 </button>
 <span className="text-sm font-bold w-12 text-center text-indigo-800">
 {activePageIndex + 1} / {activeMemo.pages.length}
 </span>
 <button 
 disabled={activePageIndex === activeMemo.pages.length - 1} 
 onClick={() => setActivePageIndex(p => p + 1)}
 className="px-3 py-1 bg-white rounded shadow-sm text-indigo-600 disabled:opacity-30 disabled:shadow-none font-bold"
 >
 
 </button>
 </div>
 </div>
 </div>

 {/* 編集エリア */}
 <div className="flex-1 overflow-y-auto p-8 flex flex-col">
 <input
 type="text"
 value={activeMemo.title}
 onChange={(e) => updateActiveMemo({ title: e.target.value })}
 placeholder="タイトル"
 className="text-3xl font-bold w-full outline-none mb-6 border-b border-transparent focus:border-slate-200 pb-2 transition-colors"
 />
 <div
 key={`${activeMemo.id}-page-${activePageIndex}`}
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
 </>
 ) : (
 <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
 <div className="text-4xl mb-4"> </div>
 <p className="font-medium">左側のリストからメモを選択するか</p>
 <p className="font-medium">新しく作成してください</p>
 </div>
 )}
 </div>

 {/* ＝＝＝ 長押し操作メニュー (モーダル) ＝＝＝ */}
 {menuTargetMemoId && (
 <div 
 className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center transition-opacity"
 onClick={() => setMenuTargetMemoId(null)}
 >
 <div 
 className="bg-white rounded-xl shadow-2xl w-64 overflow-hidden flex flex-col"
 onClick={(e) => e.stopPropagation()} // モーダル内のクリックで閉じないようにする
 >
 <div className="p-3 border-b border-slate-100 font-bold text-slate-700 text-center bg-slate-50">
 メモの操作
 </div>
 <button
 onClick={() => handleTogglePin(menuTargetMemoId)}
 className="p-4 text-left hover:bg-slate-50 transition-colors font-medium border-b border-slate-100 flex items-center gap-3 text-slate-800"
 >
 <span> </span>
 {memos.find(m => m.id === menuTargetMemoId)?.isPinned ? "ピン留めを解除" : "ピン留めする"}
 </button>
 <button
 onClick={() => handleDeleteMemo(menuTargetMemoId)}
 className="p-4 text-left hover:bg-red-50 text-red-600 transition-colors font-medium flex items-center gap-3"
 >
 <span> </span>
 メモを削除する
 </button>
 <div className="bg-slate-50 p-2 border-t border-slate-100">
 <button
 onClick={() => setMenuTargetMemoId(null)}
 className="w-full p-2 bg-white rounded-lg shadow-sm border border-slate-200 font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
 >
 キャンセル
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}