import React from 'react';
import Prism from '../components/Prism/Prism';
import { SpinningText } from "@/components/magicui/spinning-text";
import { AuroraText } from "@/components/magicui/aurora-text";
import KanbanBoard from "@/components/KanbanBoard";

const Page = () => {
  return (
    <div style={{ position: 'relative', width: '100vw', minHeight: '100vh', overflow: 'hidden' }}>
      {/* Background Prism Animation */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, backgroundColor: '#000' }}>
        <Prism
          animationType="rotate"
          timeScale={0.5}
          height={2.5}
          baseWidth={5.5}
          scale={3.6}
          hueShift={0}
          colorFrequency={1}
          noise={0}
          glow={1}
        />
      </div>

      {/* Header - Center Top */}
      <div
        className="flex items-center justify-center"
        style={{
          position: "fixed",
          top: "2px",
          left: "50%",
          transform: "translateX(-50%)",
          height: "70px",
          width: "450px",
          maxWidth: "60vw",
          overflow: "visible",
          background: "#ffffff",
          boxShadow: "0 10px 24px rgba(0,0,0,0.06)",
          padding: "0rem 0em",
          border: "1px solid rgba(0,0,0,0.06)",
          zIndex: 2,
        }}
      >
        {/* Hairline deep ocean blue border (inner) */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: "none",
            border: "1px solid #003366", // deep ocean blue
            borderRadius: "inherit",
            zIndex: 2,
            boxSizing: "border-box",
          }}
        />
        <span className="text-[40px] font-bold tracking-[0.6px] text-black whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
          Onward
        </span>
        <span className="text-[40px] font-bold tracking-[0.6px] whitespace-nowrap overflow-hidden text-ellipsis max-w-full ml-2">
          <AuroraText>and upward</AuroraText>
        </span>
      </div>

      {/* Page Content - Centered */}
      <div style={{ position: 'relative', zIndex: 1, paddingTop: '90px', paddingBottom: '120px' }}>
        <KanbanBoard />
      </div>
      {/* Bottom Center Spinning Text */}
      <div
        style={{
          position: 'fixed',
          bottom: '50px',
          right: '55px',
          zIndex: 1,
          color: '#fff',
          paddingBottom: '5px',
        }}
      >
        <SpinningText>made by meet • made for meet •</SpinningText>
      </div>
    </div>
  );
};

export default Page;
