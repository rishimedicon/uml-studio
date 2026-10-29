"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import type { UmlElement } from "@/lib/uml/types";
import { formatAttribute, formatOperation } from "@/lib/uml/format";

export type UmlNodeData = {
  element: UmlElement;
  shape: "rect" | "ellipse" | "circle" | "diamond";
  issue?: "error" | "warning";
  showMembers: boolean;
};
export type UmlNodeType = Node<UmlNodeData, "uml">;

const handleCls = "!h-2 !w-2 !border-0 !bg-blue-500 opacity-0 group-hover:opacity-100";

function Handles() {
  return (
    <>
      {[Position.Top, Position.Right, Position.Bottom, Position.Left].map((p) => (
        <Handle key={p} id={p} type="source" position={p} className={handleCls} />
      ))}
    </>
  );
}

function ring(selected: boolean, issue?: string) {
  return clsx(
    selected && "ring-2 ring-blue-500 ring-offset-1",
    !selected && issue === "error" && "ring-2 ring-red-500",
    !selected && issue === "warning" && "ring-1 ring-amber-400",
  );
}

export function UmlNode({ data, selected }: NodeProps<UmlNodeType>) {
  const el = data.element;
  switch (el.kind) {
    case "class":
    case "interface": {
      const isInterface = el.kind === "interface";
      const stereo = isInterface ? "interface" : el.stereotype;
      return (
        <div className={clsx("group min-w-[160px] max-w-[380px] border border-slate-700 bg-amber-50 text-[12px] text-slate-900 shadow-sm", ring(selected, data.issue))}>
          <Handles />
          <div className="border-b border-slate-700 px-3 py-1.5 text-center">
            {stereo && <div className="text-[11px] text-slate-600">«{stereo}»</div>}
            <div className={clsx("font-semibold", el.kind === "class" && el.isAbstract && "italic")}>{el.name}</div>
          </div>
          {data.showMembers && (
            <>
              <div className="min-h-[14px] border-b border-slate-700 px-2 py-1 font-mono text-[11.5px]">
                {el.attributes.map((a) => (
                  <div key={a.id} className={clsx("whitespace-nowrap leading-5", a.isStatic && "underline")}>{formatAttribute(a)}</div>
                ))}
              </div>
              <div className="min-h-[14px] px-2 py-1 font-mono text-[11.5px]">
                {el.operations.map((o) => (
                  <div key={o.id} className={clsx("whitespace-nowrap leading-5", o.isStatic && "underline", o.isAbstract && "italic")}>{formatOperation(o)}</div>
                ))}
              </div>
            </>
          )}
        </div>
      );
    }
    case "enumeration":
      return (
        <div className={clsx("group min-w-[150px] border border-slate-700 bg-emerald-50 text-[12px] text-slate-900 shadow-sm", ring(selected, data.issue))}>
          <Handles />
          <div className="border-b border-slate-700 px-3 py-1.5 text-center">
            <div className="text-[11px] text-slate-600">«enumeration»</div>
            <div className="font-semibold">{el.name}</div>
          </div>
          {data.showMembers && (
            <div className="px-2 py-1 font-mono text-[11.5px]">
              {el.literals.map((l, i) => (
                <div key={i} className="leading-5">{l}</div>
              ))}
            </div>
          )}
        </div>
      );
    case "actor":
      return (
        <div className={clsx("group flex w-[90px] flex-col items-center rounded p-1 text-slate-900", ring(selected, data.issue))}>
          <Handles />
          <svg width="40" height="64" viewBox="0 0 40 64" className="overflow-visible">
            <circle cx="20" cy="10" r="9" fill="#fff" stroke="#334155" strokeWidth="1.6" />
            <line x1="20" y1="19" x2="20" y2="42" stroke="#334155" strokeWidth="1.6" />
            <line x1="4" y1="28" x2="36" y2="28" stroke="#334155" strokeWidth="1.6" />
            <line x1="20" y1="42" x2="6" y2="62" stroke="#334155" strokeWidth="1.6" />
            <line x1="20" y1="42" x2="34" y2="62" stroke="#334155" strokeWidth="1.6" />
          </svg>
          {el.stereotype && <div className="text-[10px] text-slate-500">«{el.stereotype}»</div>}
          <div className="text-center text-[12px] font-medium leading-tight">{el.name}</div>
        </div>
      );
    case "useCase":
      return (
        <div className={clsx("group flex min-h-[64px] min-w-[150px] max-w-[240px] items-center justify-center rounded-[50%] border border-slate-700 bg-sky-50 px-6 py-3 text-center text-[12px] text-slate-900 shadow-sm", ring(selected, data.issue))}>
          <Handles />
          {el.name}
        </div>
      );
    case "initial":
      return (
        <div className={clsx("group h-[30px] w-[30px] rounded-full bg-slate-900", ring(selected, data.issue))}>
          <Handles />
        </div>
      );
    case "final":
      return (
        <div className={clsx("group flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-slate-900 bg-white", ring(selected, data.issue))}>
          <Handles />
          <div className="h-[18px] w-[18px] rounded-full bg-slate-900" />
        </div>
      );
    case "decision":
    case "merge":
      return (
        <div className={clsx("group relative h-[44px] w-[44px]", ring(selected, data.issue))} title={el.kind}>
          <Handles />
          <svg width="44" height="44" viewBox="0 0 44 44">
            <polygon points="22,1 43,22 22,43 1,22" fill="#fff" stroke="#334155" strokeWidth="1.6" />
          </svg>
          {el.name && <div className="absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap text-[11px] text-slate-600">{el.name}</div>}
        </div>
      );
    case "fork":
    case "join":
      return (
        <div className={clsx("group h-[10px] w-[140px] rounded-sm bg-slate-900", ring(selected, data.issue))} title={el.kind}>
          <Handles />
        </div>
      );
    case "action":
      return (
        <div className={clsx("group flex min-h-[48px] min-w-[130px] max-w-[260px] items-center justify-center rounded-2xl border border-slate-700 bg-violet-50 px-4 py-2 text-center text-[12px] text-slate-900 shadow-sm", ring(selected, data.issue))}>
          <Handles />
          {el.name}
        </div>
      );
    case "note":
      return (
        <div
          className={clsx("group relative min-h-[60px] w-[180px] whitespace-pre-wrap border border-slate-500 bg-yellow-100 px-3 py-2 text-[12px] text-slate-800", ring(selected, data.issue))}
          style={{ clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)" }}
        >
          <Handles />
          {el.name}
        </div>
      );
    default:
      return null;
  }
}

export function SystemBoundaryNode({ data }: NodeProps<Node<{ label: string; width: number; height: number }>>) {
  return (
    <div className="pointer-events-none border-2 border-slate-500 bg-white/40" style={{ width: data.width, height: data.height }}>
      <div className="px-3 py-1 text-[13px] font-semibold text-slate-700">{data.label}</div>
    </div>
  );
}

export function shapeOf(el: UmlElement): UmlNodeData["shape"] {
  if (el.kind === "useCase") return "ellipse";
  if (el.kind === "initial" || el.kind === "final") return "circle";
  if (el.kind === "decision" || el.kind === "merge") return "diamond";
  return "rect";
}
