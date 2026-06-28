import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ConfigEditorPage from "./page";
import { mihomoApi } from "@/services/api";

// Mock Monaco Editor
vi.mock("@monaco-editor/react", () => {
  return {
    default: function MockEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
      return (
        <textarea
          data-testid="monaco-editor"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    },
    DiffEditor: function MockDiffEditor({ modified, onChange }: { modified: string; onChange: (v: string) => void }) {
      return (
        <textarea
          data-testid="monaco-diff-editor"
          value={modified}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    },
  };
});

// Mock the API service
vi.mock("@/services/api", () => {
  const mockMihomo = {
    getConfigs: vi.fn(),
    getProxyProviders: vi.fn(),
    getRuleProviders: vi.fn(),
    getActiveConfig: vi.fn(),
    getConfigContent: vi.fn(),
    getProxyProviderContent: vi.fn(),
    getRuleProviderContent: vi.fn(),
    saveConfig: vi.fn(),
    saveProxyProvider: vi.fn(),
    saveRuleProvider: vi.fn(),
    validateConfig: vi.fn(),
    setActiveConfig: vi.fn(),
    createConfig: vi.fn(),
    deleteConfig: vi.fn(),
  };
  return {
    mihomoApi: mockMihomo,
    configApi: {},
  };
});

describe("ConfigEditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock setup
    vi.mocked(mihomoApi.getConfigs).mockResolvedValue(["config1.yaml"]);
    vi.mocked(mihomoApi.getProxyProviders).mockResolvedValue({ data: ["provider1.yaml"], errors: {} });
    vi.mocked(mihomoApi.getRuleProviders).mockResolvedValue({ data: ["rule1.yaml"], errors: {} });
    vi.mocked(mihomoApi.getActiveConfig).mockResolvedValue("config1.yaml");
    vi.mocked(mihomoApi.getConfigContent).mockResolvedValue("port: 7890");
    vi.mocked(mihomoApi.validateConfig).mockResolvedValue({ valid: true, issues: [], summary: "OK", checked_with: [] });
    vi.mocked(mihomoApi.saveConfig).mockResolvedValue();
  });

  it("should fetch lists and render on mount", async () => {
    render(<ConfigEditorPage />);

    // Wait for skeleton load to finish and headings/files to be rendered
    await waitFor(() => {
      expect(screen.getByText("config1.yaml")).toBeInTheDocument();
    });

    expect(screen.getByText("provider1.yaml")).toBeInTheDocument();
    expect(screen.getByText("rule1.yaml")).toBeInTheDocument();
  });

  it("should open file and allow edits and validation", async () => {
    render(<ConfigEditorPage />);

    await waitFor(() => {
      expect(screen.getByText("config1.yaml")).toBeInTheDocument();
    });

    // Click on config1.yaml file to open
    const fileButton = screen.getByText("config1.yaml");
    fireEvent.click(fileButton);

    await waitFor(() => {
      expect(mihomoApi.getConfigContent).toHaveBeenCalledWith("config1.yaml");
      expect(screen.getByTestId("monaco-editor")).toBeInTheDocument();
    });

    expect(screen.getByTestId("monaco-editor")).toHaveValue("port: 7890");

    // Edit the text area
    const textarea = screen.getByTestId("monaco-editor");
    fireEvent.change(textarea, { target: { value: "port: 9090" } });

    // Revert button should show since it is dirty
    expect(screen.getByText("Revert Draft")).toBeInTheDocument();

    // Click on Save Draft
    const saveButton = screen.getByText("Save Draft");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mihomoApi.validateConfig).toHaveBeenCalledWith("config1.yaml", "port: 9090");
      expect(mihomoApi.saveConfig).toHaveBeenCalledWith("config1.yaml", "port: 9090");
    });
  });
});
