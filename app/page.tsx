"use client";
// @ts-nocheck

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Redis } from '@upstash/redis';

// 共通の金庫（Redis）への接続
const redis = Redis.fromEnv();

// ==========================================
// 新規追加：画像リサイズ用オーバーレイコンポーネント
// ==========================================
const ImageResizer = ({ image, onResizeEnd }: { image: HTMLImageElement, onResizeEnd: () => void }) => {
 const [rect, setRect] = useState(() => image.getBoundingClientRect());

 useEffect(() => {
 const updateRect = () => {
 if (document.body.contains(image)) {
 setRect(image.getBoundingClientRect());
 }
 };
 window.addEventListener('resize', updateRect);
 window.addEventListener('scroll', updateRect, true); 
 
 const observer = new MutationObserver(updateRect);
 observer.observe(document.body, { childList: true, subtree: true, attributes: true });

 return () => {
 window.removeEventListener('resize', updateRect);
 window.removeEventListener('scroll', updateRect, true);
 observer.disconnect();
 };
 }, [image]);

 const handlePointerDown = (e: React.PointerEvent) => {
 e.preventDefault();
 e.stopPropagation();
 const startX = e.clientX;
 const startWidth = image.clientWidth;

 const onPointerMove = (moveEvent: PointerEvent) => {
 const deltaX = moveEvent.clientX - startX;
 const newWidth = Math.max(50, startWidth + deltaX);
 image.style.width = `${newWidth}px`;
 image.style.height = 'auto';
 setRect(image.getBoundingClientRect());
 };

 const onPointerUp = () => {
 document.removeEventListener('pointermove', onPointerMove);
 document.removeEventListener('pointerup', onPointerUp);
 // サイズ変更が終わったら親コンポーネントに通知（ここでRedisにも自動保存されます）
 onResizeEnd();
 };

 document.addEventListener('pointermove', onPointerMove);
 document.addEventListener('pointerup', onPointerUp);
 };

 return (
 <div 
 style={{
 position: 'fixed',
 top: rect.top,
 left: rect.left,
 width: rect.width,
 height: rect.height,
 pointerEvents: 'none',
 border: '2px solid #4f46e5',
 zIndex: 9999,
 }}
 >
 <div
 className="image-resizer-handle"
 style={{
 position: 'absolute',
 bottom: '-7px',
 right: '-7px',
 width: '14px',
 height: '14px',
 backgroundColor: '#4f46e5',
 borderRadius: '50%',
 cursor: 'nwse-resize',
 pointerEvents: 'auto',
 boxShadow: '0 0 4px rgba(0,0,0,0.3)',
 }}
 onPointerDown={handlePointerDown}
 />
 </div>
 );
};

// ==========================================
// 1. 型定義
// ==========================================
interface Folder { id: string; name: string; }
type BlockType = 'text' | 'accordion' | 'interactive-chess' | 'static-chess' | 'embed';
export interface BlockItem { id: string; type: BlockType; title?: string; content: string; }
interface MemoItem { id: string; folderId: string | null; title: string; pages: BlockItem[][]; isPinned: boolean; updatedAt: number; }
export interface BlockProps { block: BlockItem; updateBlock: (id: string, updates: Partial<BlockItem>) => void; deleteBlock: (id: string) => void; onImageSelect?: (img: HTMLImageElement | null) => void; }

// ==========================================
// 2. カスタムブロックコンポーネント群（変更なし）
// ==========================================

const RichTextBlock: React.FC<BlockProps & { pageLength: number; showBlockMenu: { show: boolean, blockId: string | null }; setShowBlockMenu: (val: { show: boolean, blockId: string | null }) => void; setLastFocused: (id: string, el: HTMLElement) => void; handleAddBlock: (afterId: string | null, type: BlockType) => void; }> = ({ block, updateBlock, deleteBlock, onImageSelect, pageLength, showBlockMenu, setShowBlockMenu, setLastFocused, handleAddBlock }) => {
 const contentRef = useRef<HTMLDivElement>(null);
 useEffect(() => { if (contentRef.current && contentRef.current.innerHTML !== block.content) { contentRef.current.innerHTML = block.content; } }, [block.content]);
 const handleClick = (e: React.MouseEvent) => { const target = e.target as HTMLElement; if (target.tagName === 'IMG' && onImageSelect) { onImageSelect(target as HTMLImageElement); } };
 const handleInput = (e: React.FormEvent<HTMLDivElement>) => { const text = e.currentTarget.textContent || ""; if (text === '/') { setShowBlockMenu({ show: true, blockId: block.id }); } else { setShowBlockMenu({ show: false, blockId: null }); } };
 const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
 const text = e.currentTarget.textContent?.trim() || "";
 if (text.startsWith("https://lichess.org/study/")) { updateBlock(block.id, { type: 'embed', content: text.replace("https://lichess.org/study/", "https://lichess.org/study/embed/") }); return; }
 if (text.match(/^https:\/\/lichess\.org\/[a-zA-Z0-9]{8,12}$/)) { updateBlock(block.id, { type: 'embed', content: text.replace("https://lichess.org/", "https://lichess.org/embed/game/") + "?theme=auto&bg=auto" }); return; }
 updateBlock(block.id, { content: e.currentTarget.innerHTML });
 };
 const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Backspace' && e.currentTarget.textContent === '' && pageLength > 1) { e.preventDefault(); deleteBlock(block.id); } };

 return (
 <div className="relative text-left w-full mb-2">
 <div ref={contentRef} contentEditable suppressContentEditableWarning onClick={handleClick} onFocus={(e) => setLastFocused(block.id, e.currentTarget)} onInput={handleInput} onBlur={handleBlur} onKeyDown={handleKeyDown} className="w-full text-lg leading-relaxed outline-none min-h-[1.5em] bg-transparent py-1 text-slate-800 break-all whitespace-pre-wrap empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 [&_img]:max-w-full [&_img]:cursor-pointer" data-placeholder="入力するか '/' でコマンドを表示" />
 {showBlockMenu.show && showBlockMenu.blockId === block.id && (
 <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
 <div className="p-2 text-xs font-bold text-slate-400 bg-slate-50 border-b border-slate-100">ブロックを追加</div>
 <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleAddBlock(block.id, 'accordion')} className="w-full text-left px-4 py-3 hover:bg-indigo-50 flex items-center gap-3 font-semibold text-slate-700 transition-colors">アコーディオン</button>
 <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleAddBlock(block.id, 'interactive-chess')} className="w-full text-left px-4 py-3 hover:bg-indigo-50 flex items-center gap-3 font-semibold text-slate-700 transition-colors border-t border-slate-50">棋譜解説盤面 (PGN)</button>
 <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleAddBlock(block.id, 'static-chess')} className="w-full text-left px-4 py-3 hover:bg-indigo-50 flex items-center gap-3 font-semibold text-slate-700 transition-colors border-t border-slate-50">自由に動かせる盤面 (FEN)</button>
 </div>
 )}
 </div>
 );
};

const EmbedBlock: React.FC<BlockProps> = ({ block, updateBlock, deleteBlock }) => (
 <div className="relative group mb-8 w-full text-left flex flex-col items-start gap-4">
 <button onClick={() => deleteBlock(block.id)} className="absolute -top-3 right-0 z-10 hidden group-hover:block bg-red-100 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-200">削除</button>
 <div className="w-full max-w-[600px] mb-4"><iframe src={block.content} width="100%" height="400" frameBorder="0" className="rounded-lg shadow-sm border border-slate-300"></iframe></div>
 </div>
);

const AccordionBlock: React.FC<BlockProps & { setLastFocused: (id: string, el: HTMLElement) => void; }> = ({ block, updateBlock, deleteBlock, onImageSelect, setLastFocused }) => {
 const contentRef = useRef<HTMLDivElement>(null);
 useEffect(() => { if (contentRef.current && contentRef.current.innerHTML !== block.content) { contentRef.current.innerHTML = block.content || ''; } }, [block.content]);
 const handleClick = (e: React.MouseEvent) => { const target = e.target as HTMLElement; if (target.tagName === 'IMG' && onImageSelect) { onImageSelect(target as HTMLImageElement); } };
 const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => { updateBlock(block.id, { content: e.currentTarget.innerHTML }); };
 return (
 <div className="relative group mb-6 text-left w-full">
 <button onClick={() => deleteBlock(block.id)} className="absolute -top-3 right-0 z-10 hidden group-hover:block bg-red-100 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-200">削除</button>
 <details className="border border-slate-300 bg-white [&_summary::-webkit-details-marker]:hidden cursor-pointer rounded-lg overflow-hidden">
 <summary className="font-bold outline-none flex items-center p-3 bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-200">
 <span className="mr-1 text-slate-600 text-sm">【タップで開閉】</span>
 <input type="text" value={block.title || ''} placeholder="タイトルを入力..." onChange={(e) => updateBlock(block.id, { title: e.target.value })} onClick={(e) => e.preventDefault()} className="flex-1 border-none outline-none bg-transparent focus:ring-0 text-slate-800 pointer-events-auto font-bold" />
 </summary>
 <div className="p-4 bg-white">
 <div ref={contentRef} contentEditable suppressContentEditableWarning onClick={handleClick} onFocus={(e) => setLastFocused(block.id, e.currentTarget)} onBlur={handleBlur} className="w-full min-h-[100px] border border-slate-200 rounded-md p-3 outline-none focus:border-indigo-400 bg-white text-slate-800 leading-relaxed [&_img]:max-w-full [&_img]:cursor-pointer empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300" data-placeholder="詳細をペースト..." />
 </div>
 </details>
 </div>
 );
};

const InteractiveChessBlock: React.FC<BlockProps> = ({ block, updateBlock, deleteBlock }) => {
 const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(-1);
 const Board = Chessboard as any;
 const parsedGame = useMemo(() => { const g = new Chess(); if (block.content) { try { g.loadPgn(block.content); } catch (e) {} } return g; }, [block.content]);
 const moveHistory = parsedGame.history();
 const safeIndex = Math.min(currentMoveIndex, moveHistory.length - 1);
 const currentFen = useMemo(() => { const g = new Chess(); for (let i = 0; i <= safeIndex; i++) { g.move(moveHistory[i]); } return g.fen(); }, [moveHistory, safeIndex]);
 useEffect(() => { setCurrentMoveIndex(moveHistory.length - 1); }, [moveHistory.length]);
 function onDrop(sourceSquare: string, targetSquare: string) {
 if (safeIndex !== moveHistory.length - 1) return false;
 try {
 const g = new Chess(currentFen);
 const move = g.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
 if (move) { parsedGame.move(move); updateBlock(block.id, { content: parsedGame.pgn() }); return true; }
 } catch (e) {}
 return false;
 }
 return (
 <div className="relative group mb-8 w-full text-left flex flex-col md:flex-row items-start gap-4">
 <button onClick={() => deleteBlock(block.id)} className="absolute top-0 right-0 z-10 hidden group-hover:block bg-red-100 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-200">削除</button>
 <div className="flex flex-col items-center">
 <div className="w-full max-w-[400px] mb-4"><Board position={currentFen} onPieceDrop={onDrop} arePiecesDraggable={safeIndex === moveHistory.length - 1} /></div>
 <div className="flex gap-4 mb-4 w-full max-w-[400px] justify-center">
 <button onClick={() => setCurrentMoveIndex(prev => Math.max(-1, prev - 1))} className="px-6 py-2 bg-slate-200 hover:bg-slate-300 rounded font-bold text-slate-700 disabled:opacity-50" disabled={safeIndex < 0}>＜ 戻る</button>
 <button onClick={() => setCurrentMoveIndex(prev => Math.min(moveHistory.length - 1, prev + 1))} className="px-6 py-2 bg-slate-200 hover:bg-slate-300 rounded font-bold text-slate-700 disabled:opacity-50" disabled={safeIndex >= moveHistory.length - 1}>進む ＞</button>
 </div>
 </div>
 <details className="flex-1 w-full max-w-[600px] text-sm text-slate-500 [&_summary::-webkit-details-marker]:hidden bg-slate-50 p-2 rounded border border-slate-200" open>
 <summary className="cursor-pointer font-bold outline-none"> PGN設定</summary>
 <div className="mt-2 flex flex-col gap-2">
 <textarea value={block.content || ''} placeholder="PGNを入力" onChange={(e) => updateBlock(block.id, { content: e.target.value })} className="w-full h-24 border border-slate-300 rounded p-2 outline-none focus:border-indigo-400 font-mono bg-white text-slate-800" />
 <div className="bg-white p-2 rounded min-h-[100px] overflow-y-auto flex flex-wrap gap-1 content-start border border-slate-300">
 {moveHistory.map((move, i) => (
 <React.Fragment key={i}>
 {i % 2 === 0 && <span className="font-bold text-slate-400 ml-1 text-sm">{Math.floor(i / 2) + 1}.</span>}
 <button onClick={() => setCurrentMoveIndex(i)} className={`px-1.5 py-0.5 rounded text-sm hover:bg-indigo-100 transition-colors ${safeIndex === i ? 'bg-indigo-200 font-bold text-indigo-900' : 'text-slate-700'}`}>{move}</button>
 </React.Fragment>
 ))}
 </div>
 </div>
 </details>
 </div>
 );
};

const StaticChessBlock: React.FC<BlockProps> = ({ block, updateBlock, deleteBlock }) => {
 const Board = Chessboard as any;
 const safeFen = useMemo(() => { try { const g = new Chess(); if (block.content && block.content !== 'start') { g.load(block.content); return g.fen(); } return 'start'; } catch (e) { return 'start'; } }, [block.content]);
 function onDrop(sourceSquare: string, targetSquare: string) {
 try {
 const g = new Chess(); if (safeFen !== 'start') g.load(safeFen);
 const move = g.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
 if (move) { updateBlock(block.id, { content: g.fen() }); return true; }
 } catch (e) {} return false;
 }
 return (
 <div className="relative group mb-8 w-full text-left flex flex-col md:flex-row items-start gap-4">
 <button onClick={() => deleteBlock(block.id)} className="absolute top-0 right-0 z-10 hidden group-hover:block bg-red-100 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-200">削除</button>
 <div className="w-full max-w-[400px] mb-4"><Board position={safeFen} onPieceDrop={onDrop} arePiecesDraggable={true} /></div>
 <details className="flex-1 w-full max-w-[600px] text-sm text-slate-500 [&_summary::-webkit-details-marker]:hidden bg-slate-50 p-2 rounded border border-slate-200" open>
 <summary className="cursor-pointer font-bold outline-none"> FEN設定</summary>
 <div className="mt-2 flex flex-col gap-2">
 <textarea value={block.content || ''} placeholder="FENを入力" onChange={(e) => updateBlock(block.id, { content: e.target.value })} className="w-full h-24 border border-slate-300 rounded p-2 outline-none focus:border-indigo-400 font-mono bg-white text-slate-800" />
 </div>
 </details>
 </div>
 );
};

// ==========================================
// 3. メインアプリケーション
// ==========================================
export default function MemoApp() {
 const [isLoaded, setIsLoaded] = useState<boolean>(false); // 追加：読み込み完了フラグ
 const [folders, setFolders] = useState<Folder[]>([]);
 const [memos, setMemos] = useState<MemoItem[]>([]);
 
 const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
 const [leftView, setLeftView] = useState<"folders" | "list">("folders");
 const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
 const [activeMemoId, setActiveMemoId] = useState<string | null>(null);
 const [activePageIndex, setActivePageIndex] = useState<number>(0);
 const [searchQuery, setSearchQuery] = useState("");
 const [menuTargetMemoId, setMenuTargetMemoId] = useState<string | null>(null);
 const [activeImage, setActiveImage] = useState<HTMLImageElement | null>(null);

 const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
 const isLongPress = useRef<boolean>(false);
 const lastFocusedBlockRef = useRef<{ id: string, element: HTMLElement } | null>(null);
 const [showBlockMenu, setShowBlockMenu] = useState<{ show: boolean, blockId: string | null }>({ show: false, blockId: null });

 // ▼▼▼ 変更①：アプリ起動時にRedisからすべてのデータを読み込む ▼▼▼
 useEffect(() => {
 const fetchAllData = async () => {
 try {
 const savedFolders = await redis.get("smartnotes_folders_v3");
 const savedMemos = await redis.get("smartnotes_memos_v3");

 if (savedFolders) setFolders(savedFolders as Folder[]);
 else setFolders([{ id: "default", name: "すべてのメモ" }]);

 if (savedMemos) setMemos(savedMemos as MemoItem[]);

 setIsLoaded(true); // 読み込み完了！
 } catch (err) {
 console.error("データの同期読み込みエラー:", err);
 setFolders([{ id: "default", name: "すべてのメモ" }]);
 setIsLoaded(true); // エラーでもとりあえず画面は表示する
 }
 };
 fetchAllData();
 }, []);
 
 // ▼▼▼ 変更②：フォルダやメモが変更されたら、自動でRedisに保存する ▼▼▼
 useEffect(() => {
 if (!isLoaded) return; // 読み込み完了前は上書き防止のために保存しない
 const saveFolders = async () => {
 if (folders.length > 0) await redis.set("smartnotes_folders_v3", folders);
 };
 saveFolders();
 }, [folders, isLoaded]);

 useEffect(() => {
 if (!isLoaded) return;
 const saveMemos = async () => {
 if (memos.length > 0) await redis.set("smartnotes_memos_v3", memos);
 };
 saveMemos();
 }, [memos, isLoaded]);
 // ▲▲▲ ここまで ▲▲▲

 useEffect(() => {
 const handleGlobalClick = (e: MouseEvent) => {
 if (activeImage) {
 const target = e.target as HTMLElement;
 if (target !== activeImage && !target.closest('.image-resizer-handle')) {
 setActiveImage(null);
 }
 }
 };
 document.addEventListener('mousedown', handleGlobalClick);
 return () => document.removeEventListener('mousedown', handleGlobalClick);
 }, [activeImage]);

 const handleCreateMemo = () => {
 const newMemo: MemoItem = { id: Date.now().toString(), folderId: activeFolderId || "default", title: "", pages: [[{ id: Date.now().toString(), type: 'text', content: '' }]], isPinned: false, updatedAt: Date.now(), };
 setMemos([newMemo, ...memos]); setActiveMemoId(newMemo.id); setActivePageIndex(0); setIsSidebarOpen(true);
 };
 const updateActiveMemo = (updates: Partial<MemoItem>) => { setMemos((prev) => prev.map((m) => (m.id === activeMemoId ? { ...m, ...updates, updatedAt: Date.now() } : m))); };
 const handleUpdateBlock = (blockId: string, updates: Partial<BlockItem>) => {
 setMemos((prev) => prev.map((m) => {
 if (m.id === activeMemoId) {
 const newPages = [...m.pages]; const pageBlocks = [...newPages[activePageIndex]];
 const blockIndex = pageBlocks.findIndex(b => b.id === blockId);
 if (blockIndex !== -1) { pageBlocks[blockIndex] = { ...pageBlocks[blockIndex], ...updates }; newPages[activePageIndex] = pageBlocks; return { ...m, pages: newPages, updatedAt: Date.now() }; }
 }
 return m;
 }));
 };
 const handleDeleteBlock = (blockId: string) => {
 setMemos((prev) => prev.map((m) => {
 if (m.id === activeMemoId) {
 const newPages = [...m.pages]; newPages[activePageIndex] = newPages[activePageIndex].filter(b => b.id !== blockId);
 if (newPages[activePageIndex].length === 0) newPages[activePageIndex] = [{ id: Date.now().toString(), type: 'text', content: '' }];
 return { ...m, pages: newPages, updatedAt: Date.now() };
 }
 return m;
 }));
 };
 const handleAddBlock = (afterBlockId: string | null, type: BlockType) => {
 const newBlock: BlockItem = { id: Date.now().toString(), type, content: '', title: type === 'accordion' ? '' : undefined };
 setMemos((prev) => prev.map((m) => {
 if (m.id === activeMemoId) {
 const newPages = [...m.pages]; const pageBlocks = [...newPages[activePageIndex]];
 if (afterBlockId === null) pageBlocks.push(newBlock);
 else { const index = pageBlocks.findIndex(b => b.id === afterBlockId); if (index !== -1) pageBlocks.splice(index + 1, 0, newBlock); else pageBlocks.push(newBlock); }
 newPages[activePageIndex] = pageBlocks; return { ...m, pages: newPages, updatedAt: Date.now() };
 }
 return m;
 }));
 setShowBlockMenu({ show: false, blockId: null });
 };
 const applyFormat = (command: string, value?: string) => { document.execCommand(command, false, value); if (lastFocusedBlockRef.current) handleUpdateBlock(lastFocusedBlockRef.current.id, { content: lastFocusedBlockRef.current.element.innerHTML }); };
 const changeFontSize = (sizePx: string) => { const selection = window.getSelection(); if (!selection || selection.rangeCount === 0) return; const span = document.createElement("span"); span.style.fontSize = `${sizePx}px`; span.textContent = selection.toString(); const range = selection.getRangeAt(0); range.deleteContents(); range.insertNode(span); if (lastFocusedBlockRef.current) handleUpdateBlock(lastFocusedBlockRef.current.id, { content: lastFocusedBlockRef.current.element.innerHTML }); };
 const handleDeleteFolder = (folderId: string, e: React.MouseEvent) => { e.stopPropagation(); if (folderId === "default") return; if (window.confirm("このフォルダを削除しますか？\n（中のメモは「すべてのメモ」に移動します）")) { setFolders(prev => prev.filter(f => f.id !== folderId)); setMemos(prev => prev.map(m => m.folderId === folderId ? { ...m, folderId: "default" } : m)); if (activeFolderId === folderId) setActiveFolderId("default"); } };
 const handleAddPage = () => { setMemos((prev) => prev.map((m) => { if (m.id === activeMemoId) { const newPages = [...m.pages, [{ id: Date.now().toString(), type: 'text' as const, content: '' }]]; return { ...m, pages: newPages, updatedAt: Date.now() }; } return m; })); setActivePageIndex(activeMemo ? activeMemo.pages.length : 0); };
 const handleDeleteCurrentPage = () => { if (!activeMemo) return; if (activeMemo.pages.length <= 1) { alert("最後のページは削除できません。"); return; } if (window.confirm(`ページ ${activePageIndex + 1} を削除しますか？`)) { setMemos((prev) => prev.map((m) => { if (m.id === activeMemoId) { const newPages = m.pages.filter((_, idx) => idx !== activePageIndex); return { ...m, pages: newPages, updatedAt: Date.now() }; } return m; })); setActivePageIndex(prev => (prev > 0 ? prev - 1 : 0)); } };
 const handlePressStart = (memoId: string) => { isLongPress.current = false; longPressTimer.current = setTimeout(() => { setMenuTargetMemoId(memoId); isLongPress.current = true; }, 600); };
 const handlePressEndOrCancel = () => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } };
 const handleTogglePin = (memoId: string) => { setMemos((prev) => prev.map((m) => (m.id === memoId ? { ...m, isPinned: !m.isPinned } : m))); setMenuTargetMemoId(null); };
 const handleDeleteMemo = (memoId: string) => { if (window.confirm("このメモを削除しますか？")) { setMemos((prev) => prev.filter((m) => m.id !== memoId)); if (activeMemoId === memoId) { setActiveMemoId(null); setActivePageIndex(0); } } setMenuTargetMemoId(null); };

 const activeMemo = memos.find((m) => m.id === activeMemoId);
 const displayMemos = memos
 .filter((m) => (activeFolderId === "default" ? true : m.folderId === activeFolderId))
 .filter((m) => { if (!searchQuery) return true; const q = searchQuery.toLowerCase(); const titleMatch = m.title.toLowerCase().includes(q); const contentMatch = m.pages.some(page => page.some(block => block.content.toLowerCase().includes(q) || (block.title && block.title.toLowerCase().includes(q)))); return titleMatch || contentMatch; })
 .sort((a, b) => { if (a.isPinned === b.isPinned) return b.updatedAt - a.updatedAt; return a.isPinned ? -1 : 1; });

 // データを読み込み中の時の画面
 if (!isLoaded) {
 return (
 <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
 <div className="text-xl font-bold text-slate-500 animate-pulse">データを同期中...</div>
 </div>
 );
 }

 return (
 <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-800 font-sans relative">
 {/* ＝＝＝ 左側ペイン (30%) ＝＝＝ */}
 {isSidebarOpen && (
 <div className="w-[30%] min-w-[280px] max-w-[400px] border-r border-slate-200 flex flex-col bg-slate-50 relative shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20">
 {leftView === "folders" && (
 <>
 <div className="p-6 pb-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 sticky top-0"><h1 className="text-2xl font-extrabold tracking-tight text-slate-900">フォルダ</h1></div>
 <div className="flex-1 overflow-y-auto p-4 space-y-2">
 {folders.map((folder) => (
 <div key={folder.id} onClick={() => { setActiveFolderId(folder.id); setLeftView("list"); setSearchQuery(""); }} className="p-3.5 bg-white rounded-xl shadow-sm border border-slate-200 cursor-pointer flex justify-between items-center group transition-all hover:shadow-md hover:border-indigo-200 hover:bg-indigo-50/50">
 <span className="font-semibold flex items-center gap-3 text-slate-700"> {folder.name}</span>
 <div className="flex items-center gap-3">
 <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded-md">{memos.filter(m => folder.id === "default" ? true : m.folderId === folder.id).length}</span>
 {folder.id !== "default" && <button onClick={(e) => handleDeleteFolder(folder.id, e)} className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600 font-semibold text-sm p-1">削除</button>}
 </div>
 </div>
 ))}
 <button onClick={() => { const name = prompt("新規フォルダ名:"); if (name && name.trim()) setFolders([...folders, { id: Date.now().toString(), name: name.trim() }]); }} className="mt-6 text-indigo-600 font-bold p-3 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-xl w-full text-left transition-all flex items-center gap-2">＋ 新規フォルダ作成</button>
 </div>
 </>
 )}

 {leftView === "list" && (
 <>
 <div className="p-4 flex flex-col gap-3 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
 <div className="flex items-center justify-between gap-2">
 <button onClick={() => setLeftView("folders")} className="text-indigo-600 font-bold py-1 pr-2 hover:opacity-70 flex items-center gap-1"> 戻る</button>
 <h1 className="text-base font-extrabold flex-1 text-center truncate text-slate-800">{folders.find(f => f.id === activeFolderId)?.name}</h1>
 <div className="w-16"></div>
 </div>
 <div className="relative">
 <input type="text" placeholder="検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm font-medium" />
 </div>
 </div>
 <div className="flex-1 overflow-y-auto p-3 space-y-2 relative">
 {displayMemos.length === 0 && <div className="text-center text-slate-400 mt-12 text-sm font-medium">メモがありません</div>}
 {displayMemos.map((memo) => (
 <div key={memo.id} onMouseDown={() => handlePressStart(memo.id)} onMouseUp={handlePressEndOrCancel} onMouseLeave={handlePressEndOrCancel} onTouchStart={() => handlePressStart(memo.id)} onTouchEnd={handlePressEndOrCancel} onTouchMove={handlePressEndOrCancel} onContextMenu={(e) => { e.preventDefault(); setMenuTargetMemoId(memo.id); }} onClick={() => { if (isLongPress.current) { isLongPress.current = false; return; } setActiveMemoId(memo.id); setActivePageIndex(0); }} className={`p-3.5 rounded-xl shadow-sm cursor-pointer border transition-all ${activeMemoId === memo.id ? "bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200" : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md"}`}>
 <div className="font-extrabold text-slate-800 text-[15px] truncate flex items-center gap-1.5">{memo.isPinned && <span className="text-sm">★</span>} {memo.title || "無題のメモ"}</div>
 <div className="text-slate-500 text-xs truncate mt-1.5 font-medium">{memo.pages[0]?.find(b => b.type === 'text')?.content.replace(/<[^>]*>?/gm, '') || "追加テキストなし"}</div>
 <div className="flex justify-between items-center mt-3"><div className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{new Date(memo.updatedAt).toLocaleDateString()}</div></div>
 </div>
 ))}
 </div>
 <button onClick={handleCreateMemo} className="absolute bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 transition-transform hover:scale-105 active:scale-95 rounded-full shadow-[0_8px_20px_rgba(79,70,229,0.3)] flex items-center justify-center text-white text-3xl pb-1.5 font-light">＋</button>
 </>
 )}
 </div>
 )}

 {/* ＝＝＝ 右側ペイン (70% or 100%) ＝＝＝ */}
 <div className="flex-1 flex flex-col bg-white relative transition-all duration-300">
 {!activeMemo && (
 <div className="absolute top-4 left-4 z-10">
 <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2.5 px-4 bg-white hover:bg-slate-50 rounded-xl shadow-sm border border-slate-200 text-slate-600 font-bold text-sm transition-all flex items-center gap-2 hover:shadow">{isSidebarOpen ? "リストを閉じる" : "リストを開く"}</button>
 </div>
 )}

 {activeMemo ? (
 <>
 <div className="flex flex-col bg-white border-b border-slate-200 shadow-sm z-10 sticky top-0">
 <div className="flex items-center justify-between p-3 px-6">
 <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 px-3 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 text-slate-600 font-bold text-sm transition-colors flex items-center gap-2">{isSidebarOpen ? " " : " "}</button>
 <div className="flex items-center text-sm font-bold text-slate-500 gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200"> 移動先: <select value={activeMemo.folderId || "default"} onChange={(e) => updateActiveMemo({ folderId: e.target.value })} className="bg-transparent font-extrabold outline-none cursor-pointer max-w-[120px] truncate text-slate-800">{folders.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}</select></div>
 </div>
 <div className="flex items-center justify-between px-6 pb-3">
 <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1 px-2 border border-slate-200 overflow-x-auto">
 <input type="color" onChange={(e) => applyFormat("foreColor", e.target.value)} className="w-6 h-6 rounded cursor-pointer border-none bg-transparent" title="文字色" />
 <div className="w-px h-4 bg-slate-300"></div>
 <select onChange={(e) => changeFontSize(e.target.value)} className="bg-transparent text-sm font-bold outline-none cursor-pointer text-slate-700" defaultValue=""><option value="" disabled>サイズ</option>{[8, 10, 12, 14, 16, 18, 20, 22, 24, 26].map(s => (<option key={s} value={s}>{s}px</option>))}</select>
 <div className="w-px h-4 bg-slate-300"></div>
 <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat("bold")} className="font-bold px-3 py-1 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors text-slate-700">B</button>
 <div className="w-px h-4 bg-slate-300"></div>
 <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat("justifyLeft")} className="px-3 py-1 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors text-slate-700 font-bold" title="左に揃える">左</button>
 <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat("justifyCenter")} className="px-3 py-1 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors text-slate-700 font-bold" title="中央に揃える">中</button>
 </div>
 <div className="flex items-center gap-1 bg-indigo-50/50 rounded-lg p-1 border border-indigo-100">
 <button disabled={activePageIndex === 0} onClick={() => setActivePageIndex(p => p - 1)} className="px-3 py-1.5 bg-white rounded-md shadow-sm text-indigo-600 disabled:opacity-40 disabled:shadow-none font-bold hover:bg-indigo-50 transition-colors"> 前のページ</button>
 <span className="text-sm font-extrabold w-16 text-center text-indigo-900 tracking-widest">{activePageIndex + 1}/{activeMemo.pages.length}</span>
 <button disabled={activePageIndex === activeMemo.pages.length - 1} onClick={() => setActivePageIndex(p => p + 1)} className="px-3 py-1.5 bg-white rounded-md shadow-sm text-indigo-600 disabled:opacity-40 disabled:shadow-none font-bold hover:bg-indigo-50 transition-colors">次のページ </button>
 </div>
 </div>
 </div>

 <div className="flex-1 overflow-y-auto w-full relative">
 <div className="w-full p-8 lg:p-12 pb-32 flex flex-col items-start text-left">
 <input type="text" value={activeMemo.title} onChange={(e) => updateActiveMemo({ title: e.target.value })} placeholder="無題のメモ" className="text-4xl lg:text-5xl font-extrabold w-full outline-none mb-10 bg-transparent placeholder-slate-300 text-slate-900 text-left" />
 <div className="space-y-4 w-full flex flex-col items-start">
 {activeMemo.pages[activePageIndex]?.map((block, index) => (
 <div key={block.id} className="relative group/block w-full flex flex-col items-start">
 <div className="absolute -left-10 top-0 opacity-0 group-hover/block:opacity-100 transition-opacity">
 <button onClick={() => setShowBlockMenu({show: true, blockId: block.id})} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded">＋</button>
 </div>
 {block.type === 'embed' && <EmbedBlock block={block} updateBlock={handleUpdateBlock} deleteBlock={handleDeleteBlock} />}
 {block.type === 'text' && <RichTextBlock block={block} updateBlock={handleUpdateBlock} deleteBlock={handleDeleteBlock} onImageSelect={setActiveImage} pageLength={activeMemo.pages[activePageIndex].length} showBlockMenu={showBlockMenu} setShowBlockMenu={setShowBlockMenu} setLastFocused={(id, el) => { lastFocusedBlockRef.current = { id, element: el }; }} handleAddBlock={handleAddBlock} />}
 {block.type === 'accordion' && <AccordionBlock block={block} updateBlock={handleUpdateBlock} deleteBlock={handleDeleteBlock} onImageSelect={setActiveImage} setLastFocused={(id, el) => { lastFocusedBlockRef.current = { id, element: el }; }} />}
 {block.type === 'interactive-chess' && <InteractiveChessBlock block={block} updateBlock={handleUpdateBlock} deleteBlock={handleDeleteBlock} />}
 {block.type === 'static-chess' && <StaticChessBlock block={block} updateBlock={handleUpdateBlock} deleteBlock={handleDeleteBlock} />}
 </div>
 ))}
 </div>
 <div className="h-32 w-full mt-4 cursor-text" onClick={() => { const lastBlock = activeMemo.pages[activePageIndex]?.[activeMemo.pages[activePageIndex].length - 1]; if (!lastBlock || lastBlock.type !== 'text' || lastBlock.content.replace(/<[^>]*>?/gm, '') !== '') { handleAddBlock(lastBlock?.id || null, 'text'); } }}></div>
 </div>
 </div>

 <div className="border-t border-slate-200 p-4 px-6 flex justify-between items-center bg-white shadow-[0_-4px_10px_rgba(0,0,0,0.02)] z-10">
 <button onClick={handleDeleteCurrentPage} className="text-red-400 hover:text-red-600 font-bold px-3 py-2 text-sm transition-colors rounded hover:bg-red-50">このページを削除</button>
 <button onClick={handleAddPage} className="bg-indigo-600 text-white hover:bg-indigo-700 font-bold px-6 py-2.5 rounded-xl shadow-md transition-all active:scale-95 text-sm">＋ 次のページを追加</button>
 </div>
 </>
 ) : (
 <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
 <p className="font-bold text-lg text-slate-500 mt-1">左側のリストからメモを選択するか新しく作成してください</p>
 </div>
 )}
 </div>

 {activeImage && (
 <ImageResizer 
 image={activeImage} 
 onResizeEnd={() => {
 if (lastFocusedBlockRef.current) {
 handleUpdateBlock(lastFocusedBlockRef.current.id, { content: lastFocusedBlockRef.current.element.innerHTML });
 }
 }} 
 />
 )}

 {menuTargetMemoId && (
 <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center transition-all" onClick={() => setMenuTargetMemoId(null)}>
 <div className="bg-white rounded-2xl shadow-2xl w-72 overflow-hidden flex flex-col scale-100 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
 <div className="p-4 border-b border-slate-100 font-extrabold text-slate-800 text-center bg-slate-50/50">メモの操作</div>
 <button onClick={() => handleTogglePin(menuTargetMemoId)} className="p-4 text-left hover:bg-slate-50 transition-colors font-bold border-b border-slate-100 flex items-center gap-3 text-slate-700">{memos.find(m => m.id === menuTargetMemoId)?.isPinned ? "ピン留めを解除" : "ピン留めする"}</button>
 <button onClick={() => handleDeleteMemo(menuTargetMemoId)} className="p-4 text-left hover:bg-red-50 text-red-600 transition-colors font-bold flex items-center gap-3">メモを削除する</button>
 <div className="bg-slate-50/80 p-3 border-t border-slate-100"><button onClick={() => setMenuTargetMemoId(null)} className="w-full p-2.5 bg-white rounded-xl shadow-sm border border-slate-200 font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-all">キャンセル</button></div>
 </div>
 </div>
 )}
 </div>
 );
}