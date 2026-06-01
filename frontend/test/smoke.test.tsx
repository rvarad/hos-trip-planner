import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("test infra", () => {
  it("renders with RTL and jest-dom matchers", () => {
    render(<div>hello</div>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
