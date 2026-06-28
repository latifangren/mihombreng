import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useModalAccessibility } from "./use-modal-accessibility";

function TestModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const containerRef = useModalAccessibility(isOpen, onClose);
  if (!isOpen) return null;
  return (
    <div ref={containerRef} data-testid="modal">
      <button type="button" data-testid="btn1">Btn 1</button>
      <button type="button" data-testid="btn2">Btn 2</button>
    </div>
  );
}

describe("useModalAccessibility", () => {
  it("should call onClose when Escape is pressed", async () => {
    const onClose = vi.fn();
    render(<TestModal isOpen={true} onClose={onClose} />);

    // Trigger escape keydown on window
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
