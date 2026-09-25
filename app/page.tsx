"use client";

import React, { useState, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

// --- 型定義 ---
interface Folder {
 id: string;
 name: string;
}

// ブロックベース設計への変更
type BlockType = "text" | "accordion" | "chess";

interface Block {
 id: string;
 type: BlockType;
 content?: string; // Textの内容 または Accordionの内容
 title?: string; // Accordionのタイトル
 pgn?: string; // ChessのPGNデータ
}

interface MemoItem {
 id: string;
 folderId: string | null;
 title: string;
 pages: Block[][]; // 文字列の配列から、ブロックの二次元配列へ拡張
 isPinned: boolean;
 updatedAt: number;
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

// ==========================================
// インタラクティブコンポーネント群
// ==========================================

function AccordionBlock({ block, updateBlock, removeBlock }: { block: Block, updateBlock: any, removeBlock: any }) {
 const [isOpen, setIsOpen] = useState(false);
 
 return (
 <div className="border border-slate-200 rounded-xl my-4 bg-white shadow-sm relative group overflow-hidden">
 <button onClick={removeBlock} className="absolute top-3 right-3 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10" title="削除"> </button>
 <div 
 onClick={() => setIsOpen(!isOpen)} 
 className="bg-slate-50 p-3 pr-12 cursor-pointer flex justify-between items-center border-b border-transparent transition-colors hover:bg-slate-100"
 >
 <input 
 value={block.title || ""} 
 onChange={e => updateBlock(block.id, { title: e.target.value })} 
 onClick={e => e.stopPropagation()} 
 placeholder="タップで開閉 (タイトルを入力)..." 
 className="bg-transparent outline-none font-bold w-full text-slate-700"
 />
 <span className="text-slate-400 font-bold transform transition-transform duration-300" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
 </div>
 <div 
 className="transition-all duration-300 ease-in-out" 
 style={{ maxHeight: isOpen ? '1000px' : '0px', opacity: isOpen ? 1 : 0 }}
 >
 <div className="p-4 border-t border-slate-100">
 <textarea 
 value={block.content || ""} 
 onChange={e => updateBlock(block.id, { content: e.target.value })} 
 placeholder="隠しコンテンツを入力..." 
 className="w-full outline-none resize-y min-h-[100px] text-slate-600 bg-transparent"
 />
 </div>
 </div>
 </div>
 );
}

function ChessBlock({ block, updateBlock, removeBlock }: { block: Block, updateBlock: any, removeBlock: any }) {
 const [chess] = useState(new Chess());
 const [currentMove, setCurrentMove] = useState(0);
 const [history, setHistory] = useState<string[]>([]);
 const [fen, setFen] = useState(chess.fen());
 const [isEditingPgn, setIsEditingPgn] = useState(!block.pgn);
 const [tempPgn, setTempPgn] = useState(block.pgn || "");

 useEffect(() => {
 if (block.pgn) {
 try {
 const tempChess = new Chess();
 tempChess.loadPgn(block.pgn);
 const hist = tempChess.history();
 setHistory(hist);
 
 // 指定手数まで進めた盤面を生成
 const displayChess = new Chess();
 for (let i = 0; i < currentMove; i++) {
 displayChess.move(hist[i]);
 }
 setFen(displayChess.fen());
 } catch (e) {
 console.error("Invalid PGN");
 }
 }
 }, [block.pgn, currentMove]);

 const handleApply = () => {
 updateBlock(block.id, { pgn: tempPgn });
 setCurrentMove(0);
 setIsEditingPgn(false);
 };

 const handlePrev = () => setCurrentMove(p => Math.max(0, p - 1));
 const handleNext = () => setCurrentMove(p => Math.min(history.length, p + 1));

 return (
 <div className="border border-slate-200 rounded-xl my-4 p-5 bg-slate-50 relative group shadow-sm">
 <button onClick={removeBlock} className="absolute top-3 right-3 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="削除"> </button>
 <div className="font-bold text-slate-700 mb-4 flex items-center gap-2">
 <span className="text-xl"> </span> インタラクティブ・チェスボード
 </div>
 {isEditingPgn ? (
 <div className="flex flex-col gap-3">
 <textarea 
 className="w-full p-3 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-300 resize-y" 
 rows={4} 
 placeholder="ここにPGNフォーマットの棋譜を貼り付けてください..."
 value={tempPgn}
 onChange={(e) => setTempPgn(e.target.value)}
 />
 <button onClick={handleApply} className="self-end px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors text-sm shadow-sm">盤面を生成</button>
 </div>
 ) : (
 <div className="flex flex-col items-center gap-4">
 <div className="w-full max-w-[340px] aspect-square rounded-sm overflow-hidden shadow-md bg-white">
 <Chessboard position={fen} arePiecesDraggable={false} />
 </div>
 <div className="flex items-center gap-6 bg-white px-5 py-2 rounded-full shadow-sm border border-slate-200">
 <button onClick={handlePrev} disabled={currentMove === 0} className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full disabled:opacity-30 disabled:hover:bg-slate-100 font-bold transition-colors"> </button>
 <span className="text-sm font-bold w-16 text-center text-slate-600">{currentMove} / {history.length}</span>
 <button onClick={handleNext} disabled={currentMove === history.length} className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full disabled:opacity-30 disabled:hover:bg-slate-100 font-bold transition-colors"> </button>
 </div>
 <button onClick={() => setIsEditingPgn(true)} className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold underline mt-1 transition-colors">PGNを再編集</button>
 </div>
 )}
 </div>
 );
}


// ==========================================
// メインアプリコンポーネント
// ==========================================

export default function MemoApp() {
 const [folders, setFolders] = useState<Folder[]>([]);
 const [memos, setMemos] = useState<MemoItem[]>([]);

 const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
 const [leftView, setLeftView] = useState<"folders" | "list">("folders");
 const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
 const [activeMemoId, setActiveMemoId] = useState<string | null>(null);

 const [activePageIndex, setActivePageIndex] = useState<number>(0);
 const [searchQuery, setSearchQuery] = useState("");

 const [menuTargetMemoId, setMenuTargetMemoId] = useState<string | null>(null);
 const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
 const isLongPress = useRef<boolean>(false);

 // --- 初期化・自動保存 ---
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
 // 古い構造（単なるHTML文字列配列）からのマイグレーション
 const migratedMemos = parsedMemos.map((m: any) => {
 const pagesData = m.pages || [m.content || ""];
 const newPages = pagesData.map((page: any) => {
 if (typeof page === "string") {
 return [{ id: generateId(), type: "text", content: page }];
 }
 return page;
 });
 return { ...m, pages: newPages };
 });
 setMemos(migratedMemos);
 }
 }, []);

 useEffect(() => {
 if (folders.length > 0) localStorage.setItem("smartnotes_folders", JSON.stringify(folders));
 }, [folders]);

 useEffect(() => {
 if (memos.length > 0) localStorage.setItem("smartnotes_memos", JSON.stringify(memos));
 }, [memos]);

 // --- メモ・フォルダ操作 ---
 const handleCreateMemo = () => {
 const newMemo: MemoItem = {
 id: Date.now().toString(),
 folderId: activeFolderId || "default",
 title: "",
 pages: [[{ id: generateId(), type: "text", content: "" }]],
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

 const handleDeleteFolder = (folderId: string, e: React.MouseEvent) => {
 e.stopPropagation();
 if (folderId === "default") return;
 if (window.confirm("このフォルダを削除しますか？\n（中のメモは「すべてのメモ」に移動します）")) {
 setFolders(prev => prev.filter(f => f.id !== folderId));
 setMemos(prev => prev.map(m => m.folderId === folderId ? { ...m, folderId: "default" } : m));
 if (activeFolderId === folderId) setActiveFolderId("default");
 }
 };

 // --- ブロック操作 ---
 const addBlock = (type: BlockType) => {
 setMemos(prev => prev.map(m => {
 if (m.id === activeMemoId) {
 const newPages = [...m.pages];
 const currentBlocks = [...newPages[activePageIndex]];
 
 // 指定されたコンポーネントブロックを追加
 if (type === "accordion") currentBlocks.push({ id: generateId(), type: "accordion", title: "", content: "" });
 if (type === "chess") currentBlocks.push({ id: generateId(), type: "chess", pgn: "" });
 
 // その後にテキスト入力ブロックを配置して編集を継続しやすくする
 currentBlocks.push({ id: generateId(), type: "text", content: "" });
 
 newPages[activePageIndex] = currentBlocks;
 return { ...m, pages: newPages, updatedAt: Date.now() };
 }
 return m;
 }));
 };

 const updateBlock = (blockId: string, updates: Partial<Block>) => {
 setMemos(prev => prev.map(m => {
 if (m.id === activeMemoId) {
 const newPages = [...m.pages];
 newPages[activePageIndex] = newPages[activePageIndex].map((b: any) => 
 b.id === blockId ? { ...b, ...updates } : b
 );
 return { ...m, pages: newPages, updatedAt: Date.now() };
 }
 return m;
 }));
 };

 const removeBlock = (blockId: string) => {
 if (window.confirm("このブロックを削除しますか？")) {
 setMemos(prev => prev.map(m => {
 if (m.id === activeMemoId) {
 const newPages = [...m.pages];
 newPages[activePageIndex] = newPages[activePageIndex].filter((b: any) => b.id !== blockId);
 return { ...m, pages: newPages, updatedAt: Date.now() };
 }
 return m;
 }));
 }
 };

 // --- ページ操作 ---
 const handleAddPage = () => {
 setMemos((prev) =>
 prev.map((m) => {
 if (m.id === activeMemoId) {
 const newPages = [...m.pages, [{ id: generateId(), type: "text", content: "" }]];
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
 alert("最後のページは削除できません。");
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
 }, 600);
 };

 const handlePressEndOrCancel = () => {
 if (longPressTimer.current) {
 clearTimeout(longPressTimer.current);
 longPressTimer.current = null;
 }
 };

 const handleTogglePin = (memoId: string) => {
 setMemos((prev) => prev.map((m) => (m.id === memoId ? { ...m, isPinned: !m.isPinned } : m)));
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
 // Note: onBlur等で後からupdateBlockに同期されます
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
 };

 // --- 描画ロジック ---
 const activeMemo = memos.find((m) => m.id === activeMemoId);
 const displayMemos = memos
 .filter((m) => (activeFolderId === "default" ? true : m.folderId === activeFolderId))
 .filter((m) => {
 if (!searchQuery) return true;
 const q = searchQuery.toLowerCase();
 const titleMatch = m.title.toLowerCase().includes(q);
 const contentMatch = m.pages.some(page => 
 page.some((b: any) => {
 if (b.type === 'text') return b.content?.toLowerCase().includes(q);
 if (b.type === 'accordion') return b.title?.toLowerCase().includes(q) || b.content?.toLowerCase().includes(q);
 if (b.type === 'chess') return b.pgn?.toLowerCase().includes(q);
 return false;
 })
 );
 return titleMatch || contentMatch;
 })
 .sort((a, b) => {
 if (a.isPinned === b.isPinned) return b.updatedAt - a.updatedAt;
 return a.isPinned ? -1 : 1;
 });

 // リストのサマリー抽出用ヘルパー
 const extractSummary = (pages: Block[][]) => {
 const rawText = pages.map(page => 
 page.map(b => {
 if (b.type === "text") return b.content;
 if (b.type === "accordion") return `${b.title} ${b.content}`;
 if (b.type === "chess") return "[チェス盤]";
 return "";
 }).join(" ")
 ).join(" ");
 return rawText.replace(/<[^>]*>?/gm, '').substring(0, 50) || "追加テキストなし";
 };

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
 onMouseDown={() => handlePressStart(memo.id)}
 onMouseUp={handlePressEndOrCancel}
 onMouseLeave={handlePressEndOrCancel}
 onTouchStart={() => handlePressStart(memo.id)}
 onTouchEnd={handlePressEndOrCancel}
 onTouchMove={handlePressEndOrCancel}
 onContextMenu={(e) => {
 e.preventDefault();
 setMenuTargetMemoId(memo.id);
 }}
 onClick={() => {
 if (isLongPress.current) {
 isLongPress.current = false;
 return;
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
 {extractSummary(memo.pages)}
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

 {/* ＝＝＝ 右側ペイン ＝＝＝ */}
 <div className="flex-1 flex flex-col bg-white relative transition-all duration-300">
 {!activeMemo && (
 <div className="absolute top-4 left-4 z-10">
 <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-white hover:bg-slate-100 rounded-lg shadow-sm border border-slate-200 text-slate-600 font-bold text-sm transition-colors flex items-center gap-2">
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
 {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
 </select>
 </div>
 </div>

 {/* 装飾ツールバー ＆ ページ切り替え */}
 <div className="flex items-center justify-between px-3 pb-3">
 <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 px-2 overflow-x-auto">
 <input type="color" onChange={(e) => applyFormat("foreColor", e.target.value)} className="w-6 h-6 rounded cursor-pointer border-none bg-transparent" title="文字色" />
 <div className="w-px h-4 bg-slate-300"></div>
 <select onChange={(e) => changeFontSize(e.target.value)} className="bg-transparent text-sm font-semibold outline-none cursor-pointer" defaultValue="">
 <option value="" disabled>サイズ</option>
 {[8, 10, 12, 14, 16, 18, 20, 22, 24, 26].map(s => <option key={s} value={s}>{s}px</option>)}
 </select>
 <div className="w-px h-4 bg-slate-300"></div>
 <button onClick={() => applyFormat("bold")} className="font-bold px-3 hover:text-indigo-600 transition-colors" title="太字">B</button>
 <div className="w-px h-4 bg-slate-300"></div>
 
 {/* 新機能コンポーネント追加ボタン */}
 <button onClick={() => addBlock("accordion")} className="px-2 py-1 hover:bg-slate-200 rounded text-sm font-bold text-slate-600 transition-colors flex items-center gap-1" title="アコーディオンを追加">
 追加
 </button>
 <button onClick={() => addBlock("chess")} className="px-2 py-1 hover:bg-slate-200 rounded text-sm font-bold text-slate-600 transition-colors flex items-center gap-1" title="チェス盤を追加">
 追加
 </button>
 </div>

 <div className="flex items-center gap-2 bg-indigo-50 rounded-lg p-1 border border-indigo-100 ml-4">
 <button disabled={activePageIndex === 0} onClick={() => setActivePageIndex(p => p - 1)} className="px-3 py-1 bg-white rounded shadow-sm text-indigo-600 disabled:opacity-30 disabled:shadow-none font-bold"> </button>
 <span className="text-sm font-bold w-12 text-center text-indigo-800">{activePageIndex + 1} / {activeMemo.pages.length}</span>
 <button disabled={activePageIndex === activeMemo.pages.length - 1} onClick={() => setActivePageIndex(p => p + 1)} className="px-3 py-1 bg-white rounded shadow-sm text-indigo-600 disabled:opacity-30 disabled:shadow-none font-bold"> </button>
 </div>
 </div>
 </div>

 {/* 編集エリア (ブロックベース) */}
 <div className="flex-1 overflow-y-auto p-8 flex flex-col pb-32">
 <input
 type="text"
 value={activeMemo.title}
 onChange={(e) => updateActiveMemo({ title: e.target.value })}
 placeholder="タイトル"
 className="text-3xl font-bold w-full outline-none mb-6 border-b border-transparent focus:border-slate-200 pb-2 transition-colors"
 />
 
 {activeMemo.pages[activePageIndex]?.map((block) => {
 if (block.type === "text") {
 return (
 <div
 key={block.id}
 contentEditable
 suppressContentEditableWarning
 onBlur={(e) => updateBlock(block.id, { content: e.currentTarget.innerHTML })}
 className="w-full outline-none leading-relaxed text-lg min-h-[1.5rem] py-1 empty:before:content-['テキストを入力...'] empty:before:text-slate-300"
 dangerouslySetInnerHTML={{ __html: block.content || "" }}
 />
 );
 } else if (block.type === "accordion") {
 return <AccordionBlock key={block.id} block={block} updateBlock={updateBlock} removeBlock={() => removeBlock(block.id)} />;
 } else if (block.type === "chess") {
 return <ChessBlock key={block.id} block={block} updateBlock={updateBlock} removeBlock={() => removeBlock(block.id)} />;
 }
 return null;
 })}
 </div>

 {/* ページ追加・削除フッター */}
 <div className="border-t border-slate-100 p-3 flex justify-between items-center bg-white">
 <button onClick={handleDeleteCurrentPage} className="text-red-400 hover:text-red-600 font-semibold px-2 py-2 text-sm transition-colors">
 このページを削除
 </button>
 <button onClick={handleAddPage} className="bg-indigo-600 text-white hover:bg-indigo-700 font-bold px-4 py-2 rounded-lg shadow-sm transition-colors text-sm">
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
 <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center transition-opacity" onClick={() => setMenuTargetMemoId(null)}>
 <div className="bg-white rounded-xl shadow-2xl w-64 overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
 <div className="p-3 border-b border-slate-100 font-bold text-slate-700 text-center bg-slate-50">メモの操作</div>
 <button onClick={() => handleTogglePin(menuTargetMemoId)} className="p-4 text-left hover:bg-slate-50 transition-colors font-medium border-b border-slate-100 flex items-center gap-3 text-slate-800">
 <span> </span> {memos.find(m => m.id === menuTargetMemoId)?.isPinned ? "ピン留めを解除" : "ピン留めする"}
 </button>
 <button onClick={() => handleDeleteMemo(menuTargetMemoId)} className="p-4 text-left hover:bg-red-50 text-red-600 transition-colors font-medium flex items-center gap-3">
 <span> </span> メモを削除する
 </button>
 <div className="bg-slate-50 p-2 border-t border-slate-100">
 <button onClick={() => setMenuTargetMemoId(null)} className="w-full p-2 bg-white rounded-lg shadow-sm border border-slate-200 font-semibold text-slate-600 hover:bg-slate-100 transition-colors">キャンセル</button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}