"use client";

import React, { useState, useRef } from "react";

// メモの型定義
interface MemoItem {
 id: string;
 title: string;
 content: string;
 isDeleted: boolean;
 isBookmark: boolean;
 fontSize: string;
 fontColor: string;
 fontFamily: string;
 pdfUrl?: string;
 fen?: string;
 treeData?: string[];
}

export default function MemoApp() {
 // 初期メモデータ
 const [memos, setMemos] = useState<MemoItem[]>([
 {
 id: "1",
 title: "チェス研究ノート",
 content: "シシリアン・ディフェンスの要点。d4を巡る攻防に注目。",
 isDeleted: false,
 isBookmark: true,
 fontSize: "18px",
 fontColor: "#1e293b",
 fontFamily: "sans-serif",
 fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2",
 treeData: ["オープニング戦略", " ├── 1. e4 c5", " └── 2. Nf3 d6", "エンドゲーム対策"],
 },
 {
 id: "2",
 title: "プロジェクト仕様書",
 content: "新メモアプリの要件定義。iPad対応とセマンティック検索を重視。",
 isDeleted: false,
 isBookmark: false,
 fontSize: "16px",
 fontColor: "#0f172a",
 fontFamily: "sans-serif",
 },
 ]);

 const [activeId, setActiveId] = useState<string>("1");
 const [showTrash, setShowTrash] = useState<boolean>(false);
 const [isSplitView, setIsSplitView] = useState<boolean>(true);
 const [searchQuery, setSearchQuery] = useState<string>("");
 const [isAiSearch, setIsAiSearch] = useState<boolean>(false);

 // Undo / Redo 用の履歴管理
 const [history, setHistory] = useState<{ [id: string]: string[] }>({});
 const [future, setFuture] = useState<{ [id: string]: string[] }>({});

 const activeMemo = memos.find((m) => m.id === activeId) || memos.find((m) => !m.isDeleted);

 // メモの更新
 const updateActiveMemo = (updates: Partial<MemoItem>) => {
 if (!activeMemo) return;
 setMemos((prev) =>
 prev.map((m) => (m.id === activeMemo.id ? { ...m, ...updates } : m))
 );
 };

 // 本文変更と履歴記録 (Undo用)
 const handleContentChange = (newContent: string) => {
 if (!activeMemo) return;
 setHistory((prev) => ({
 ...prev,
 [activeMemo.id]: [...(prev[activeMemo.id] || []), activeMemo.content],
 }));
 setFuture((prev) => ({ ...prev, [activeMemo.id]: [] }));
 updateActiveMemo({ content: newContent });
 };

 // Undo (巻き戻し)
 const handleUndo = () => {
 if (!activeMemo) return;
 const memoHistory = history[activeMemo.id] || [];
 if (memoHistory.length === 0) return;

 const previousContent = memoHistory[memoHistory.length - 1];
 setHistory((prev) => ({
 ...prev,
 [activeMemo.id]: memoHistory.slice(0, -1),
 }));
 setFuture((prev) => ({
 ...prev,
 [activeMemo.id]: [activeMemo.content, ...(prev[activeMemo.id] || [])],
 }));
 updateActiveMemo({ content: previousContent });
 };

 // Redo (やり直し)
 const handleRedo = () => {
 if (!activeMemo) return;
 const memoFuture = future[activeMemo.id] || [];
 if (memoFuture.length === 0) return;

 const nextContent = memoFuture[0];
 setFuture((prev) => ({
 ...prev,
 [activeMemo.id]: memoFuture.slice(1),
 }));
 setHistory((prev) => ({
 ...prev,
 [activeMemo.id]: [...(prev[activeMemo.id] || []), activeMemo.content],
 }));
 updateActiveMemo({ content: nextContent });
 };

 // 新規メモ作成
 const handleCreateMemo = () => {
 const newMemo: MemoItem = {
 id: Date.now().toString(),
 title: "無題のメモ",
 content: "",
 isDeleted: false,
 isBookmark: false,
 fontSize: "16px",
 fontColor: "#1e293b",
 fontFamily: "sans-serif",
 };
 setMemos([newMemo, ...memos]);
 setActiveId(newMemo.id);
 };

 // PDFアップロード
 const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file && file.type === "application/pdf") {
 const url = URL.createObjectURL(file);
 updateActiveMemo({ pdfUrl: url });
 }
 };

 // 検索・ハイライトフィルター
 const filteredMemos = memos.filter((m) => {
 if (showTrash) return m.isDeleted;
 if (m.isDeleted) return false;
 if (!searchQuery) return true;
 if (isAiSearch) {
 // セマンティック/AI検索の簡易シミュレーション
 return (
 m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
 m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
 (m.title.length + m.content.length > 0 && searchQuery.length > 1)
 );
 }
 return (
 m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
 m.content.toLowerCase().includes(searchQuery.toLowerCase())
 );
 });

 return (
 <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-800">
 {/* ===== サイドバー (目次・一覧・ゴミ箱) ===== */}
 <aside className="w-80 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white">
 {/* ヘッダー・検索 */}
 <div className="p-4 border-b border-slate-200 space-y-3">
 <div className="flex items-center justify-between">
 <h1 className="text-xl font-bold tracking-wide text-indigo-600">SmartNotes</h1>
 <button
 onClick={handleCreateMemo}
 className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
 >
 ＋ 新規
 </button>
 </div>

 {/* 検索バー */}
 <div className="space-y-1">
 <input
 type="text"
 placeholder={isAiSearch ? " AIセマンティック検索..." : " キーワード検索..."}
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
 />
 <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
 <label className="flex items-center space-x-1 cursor-pointer">
 <input
 type="checkbox"
 checked={isAiSearch}
 onChange={(e) => setIsAiSearch(e.target.checked)}
 className="rounded text-indigo-600"
 />
 <span>AI検索 (文脈理解)</span>
 </label>
 <button
 onClick={() => setShowTrash(!showTrash)}
 className={`hover:underline ${showTrash ? "text-red-500 font-bold" : ""}`}
 >
 {showTrash ? "メモ一覧へ" : " ゴミ箱"}
 </button>
 </div>
 </div>
 </div>

 {/* メモ一覧 (本の目次スタイル) */}
 <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
 {filteredMemos.map((memo) => (
 <div
 key={memo.id}
 onClick={() => setActiveId(memo.id)}
 className={`p-3.5 cursor-pointer transition flex flex-col gap-1 ${
 activeMemo?.id === memo.id ? "bg-indigo-50 border-l-4 border-indigo-600" : "hover:bg-slate-50"
 }`}
 >
 <div className="flex items-center justify-between">
 <span className="font-semibold text-sm truncate flex items-center gap-1">
 {memo.isBookmark && <span title="しおり"> </span>}
 {memo.title || "無題のメモ"}
 </span>
 {showTrash ? (
 <button
 onClick={(e) => {
 e.stopPropagation();
 updateActiveMemo({ isDeleted: false });
 }}
 className="text-xs text-emerald-600 hover:underline font-semibold"
 >
 復元
 </button>
 ) : (
 <button
 onClick={(e) => {
 e.stopPropagation();
 setMemos(memos.map((m) => (m.id === memo.id ? { ...m, isDeleted: true } : m)));
 }}
 className="text-xs text-slate-400 hover:text-red-500"
 >
 削除
 </button>
 )}
 </div>
 <p className="text-xs text-slate-500 truncate">
 {memo.content || "内容がありません"}
 </p>
 </div>
 ))}
 </div>
 </aside>

 {/* ===== メインエディタエリア ===== */}
 <main className="flex-1 flex flex-col h-full overflow-hidden bg-white">
 {activeMemo ? (
 <>
 {/* ツールバー */}
 <div className="h-14 border-b border-slate-200 px-4 flex items-center justify-between gap-3 bg-slate-50 flex-wrap overflow-x-auto">
 <div className="flex items-center gap-2">
 {/* 巻き戻し (Undo / Redo) */}
 <button
 onClick={handleUndo}
 title="元に戻す (Undo)"
 className="p-1.5 px-2.5 bg-white border border-slate-300 rounded hover:bg-slate-100 text-sm font-semibold"
 >
 ↩ 戻す
 </button>
 <button
 onClick={handleRedo}
 title="やり直す (Redo)"
 className="p-1.5 px-2.5 bg-white border border-slate-300 rounded hover:bg-slate-100 text-sm font-semibold"
 >
 ↪ 進む
 </button>

 <div className="h-6 w-px bg-slate-300 mx-1" />

 {/* 文字の大きさ */}
 <select
 value={activeMemo.fontSize}
 onChange={(e) => updateActiveMemo({ fontSize: e.target.value })}
 className="text-xs border border-slate-300 rounded p-1 bg-white"
 >
 <option value="14px">小 (14px)</option>
 <option value="16px">中 (16px)</option>
 <option value="20px">大 (20px)</option>
 <option value="26px">特大 (26px)</option>
 </select>

 {/* 文字の色 */}
 <input
 type="color"
 value={activeMemo.fontColor}
 onChange={(e) => updateActiveMemo({ fontColor: e.target.value })}
 className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
 title="文字色"
 />

 {/* フォント種類 */}
 <select
 value={activeMemo.fontFamily}
 onChange={(e) => updateActiveMemo({ fontFamily: e.target.value })}
 className="text-xs border border-slate-300 rounded p-1 bg-white"
 >
 <option value="sans-serif">ゴシック</option>
 <option value="serif">明朝</option>
 <option value="monospace">等幅</option>
 </select>

 <div className="h-6 w-px bg-slate-300 mx-1" />

 {/* しおり / ブックマーク */}
 <button
 onClick={() => updateActiveMemo({ isBookmark: !activeMemo.isBookmark })}
 className={`p-1.5 px-2 text-xs rounded border ${
 activeMemo.isBookmark ? "bg-amber-100 border-amber-300 text-amber-800" : "bg-white border-slate-300"
 }`}
 >
 {activeMemo.isBookmark ? " しおり解除" : " しおりを挟む"}
 </button>

 {/* PDF 添付 */}
 <label className="p-1.5 px-2 text-xs bg-white border border-slate-300 rounded hover:bg-slate-100 cursor-pointer">
 PDF貼付
 <input type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" />
 </label>
 </div>

 {/* 表示モード切り替え (スプリットビュー) */}
 <div className="flex items-center gap-2">
 <button
 onClick={() => setIsSplitView(!isSplitView)}
 className={`p-1.5 px-3 text-xs font-semibold rounded border ${
 isSplitView ? "bg-indigo-600 text-white" : "bg-white border-slate-300"
 }`}
 >
 ◫ スプリットビュー
 </button>
 </div>
 </div>

 {/* エディタ & プレビュー (スプリットビュー対応) */}
 <div className="flex-1 flex overflow-hidden">
 {/* 左パネル: 入力画面 */}
 <div className={`flex flex-col p-6 overflow-y-auto ${isSplitView ? "w-1/2 border-r border-slate-200" : "w-full"}`}>
 <input
 type="text"
 value={activeMemo.title}
 onChange={(e) => updateActiveMemo({ title: e.target.value })}
 placeholder="タイトルを入力..."
 className="text-2xl font-bold mb-4 outline-none border-b border-transparent focus:border-slate-300 pb-1"
 />

 <textarea
 value={activeMemo.content}
 onChange={(e) => handleContentChange(e.target.value)}
 placeholder="ここからメモを入力..."
 style={{
 fontSize: activeMemo.fontSize,
 color: activeMemo.fontColor,
 fontFamily: activeMemo.fontFamily,
 }}
 className="flex-1 w-full outline-none resize-none leading-relaxed bg-transparent"
 />
 </div>

 {/* 右パネル: 拡張機能ビュー (PDF/FEN/ツリー/ハイライトプレビュー) */}
 {isSplitView && (
 <div className="w-1/2 p-6 overflow-y-auto bg-slate-50 flex flex-col gap-6">
 {/* キーワードハイライト表示 */}
 <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
 <h3 className="text-xs font-bold uppercase text-slate-400 mb-2">検索ハイライト表示</h3>
 <div
 className="whitespace-pre-wrap leading-relaxed"
 style={{ fontSize: activeMemo.fontSize }}
 >
 {searchQuery ? (
 activeMemo.content.split(new RegExp(`(${searchQuery})`, "gi")).map((part, i) =>
 part.toLowerCase() === searchQuery.toLowerCase() ? (
 <mark key={i} className="bg-yellow-300 font-semibold px-0.5 rounded">
 {part}
 </mark>
 ) : (
 part
 )
 )
 ) : (
 activeMemo.content || <span className="text-slate-400">プレビューがここに表示されます</span>
 )}
 </div>
 </div>

 {/* チェス PGN / FEN サポート */}
 <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
 <h3 className="text-xs font-bold uppercase text-slate-400 mb-2"> チェス PGN / FEN ビューア</h3>
 <input
 type="text"
 value={activeMemo.fen || ""}
 onChange={(e) => updateActiveMemo({ fen: e.target.value })}
 placeholder="FEN文字列 (例: rnbqkbnr/pppppppp/...)"
 className="w-full text-xs font-mono p-2 border rounded mb-2 bg-slate-50"
 />
 {activeMemo.fen && (
 <div className="w-48 h-48 border-2 border-slate-700 grid grid-cols-8 grid-rows-8 mx-auto text-[10px] font-mono text-center">
 {Array.from({ length: 64 }).map((_, idx) => {
 const isBlack = (Math.floor(idx / 8) + (idx % 8)) % 2 === 1;
 return (
 <div
 key={idx}
 className={`flex items-center justify-center ${isBlack ? "bg-amber-800 text-white" : "bg-amber-100 text-slate-900"}`}
 >
 {idx === 0 ? "♜" : idx === 4 ? "♚" : ""}
 </div>
 );
 })}
 </div>
 )}
 </div>

 {/* ツリー構造のアウトライナー入力 */}
 {activeMemo.treeData && (
 <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
 <h3 className="text-xs font-bold uppercase text-slate-400 mb-2"> ツリー構造ノート</h3>
 <ul className="space-y-1 text-sm font-mono bg-slate-50 p-2 rounded">
 {activeMemo.treeData.map((node, i) => (
 <li key={i} className="text-slate-700">
 {node}
 </li>
 ))}
 </ul>
 </div>
 )}

 {/* 貼り付けられたPDFプレビュー */}
 {activeMemo.pdfUrl && (
 <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-80">
 <h3 className="text-xs font-bold uppercase text-slate-400 mb-2"> 添付PDFプレビュー</h3>
 <iframe src={activeMemo.pdfUrl} className="w-full flex-1 border rounded" />
 </div>
 )}
 </div>
 )}
 </div>
 </>
 ) : (
 <div className="flex-1 flex items-center justify-center text-slate-400">
 メモを選択するか、新規作成してください
 </div>
 )}
 </main>
 </div>
 );
}