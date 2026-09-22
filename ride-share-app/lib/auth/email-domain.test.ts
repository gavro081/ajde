import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { allowedStudentDomains, isAllowedStudentEmail } from "./email-domain";

afterEach(() => { vi.unstubAllEnvs(); });

describe("student email domains", () => {
  it("defaults to the FINKI student domains", () => {
    vi.stubEnv("STUDENT_EMAIL_DOMAINS", "");
    expect(allowedStudentDomains()).toEqual(["students.finki.ukim.mk", "student.finki.ukim.mk"]);
  });

  it("normalizes a configured comma-separated list", () => {
    vi.stubEnv("STUDENT_EMAIL_DOMAINS", " UKIM.edu.mk , ,ugd.edu.mk ");
    expect(allowedStudentDomains()).toEqual(["ukim.edu.mk", "ugd.edu.mk"]);
  });

  it.each([
    ["ana@students.finki.ukim.mk", true],
    ["  Ana@Students.FINKI.ukim.mk ", true],
    ["ana@gmail.com", false],
    ["ana@evil-students.finki.ukim.mk", false],
    ["ana@students.finki.ukim.mk.evil.com", false],
    ["students.finki.ukim.mk", false],
    ["@students.finki.ukim.mk", false],
    ["ana@", false],
    ["", false],
  ])("allows %j: %s", (email, allowed) => {
    vi.stubEnv("STUDENT_EMAIL_DOMAINS", "");
    expect(isAllowedStudentEmail(email)).toBe(allowed);
  });

  it("only accepts the configured domains once they are set", () => {
    vi.stubEnv("STUDENT_EMAIL_DOMAINS", "ugd.edu.mk");
    expect(isAllowedStudentEmail("ana@ugd.edu.mk")).toBe(true);
    expect(isAllowedStudentEmail("ana@students.finki.ukim.mk")).toBe(false);
  });
});
