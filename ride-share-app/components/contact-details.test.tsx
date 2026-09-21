// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ContactDetails } from "./contact-details";
afterEach(cleanup);
it("makes a normalized phone callable and social profiles safe to open", () => {
  render(<ContactDetails phone="+389 70 123-456" socialUrl="https://x.com/student" />);
  expect(screen.getByText("+38970123456").getAttribute("href")).toBe("tel:+38970123456");
  const social=screen.getByRole("link",{name:/Social profile/});
  expect(social.getAttribute("href")).toBe("https://x.com/student");
  expect(social.getAttribute("rel")).toBe("noopener noreferrer");
});
it("does not turn unsafe legacy values into links", () => {
  render(<ContactDetails phone="bad" socialUrl="javascript:alert(1)" facebook="data:text/html,x" />);
  expect(screen.queryAllByRole("link")).toHaveLength(0);
});
it("deduplicates existing social fields", () => {
  render(<ContactDetails socialUrl="https://instagram.com/student" instagram="https://instagram.com/student" />);
  expect(screen.getAllByRole("link")).toHaveLength(1);
});
