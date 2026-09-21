import { describe, expect, it } from "vitest";
import { contactSchema, phoneSchema, safeSocialUrl } from "./contact";
describe("profile contacts", () => {
  it("normalizes phone formatting without assuming a country", () => {
    expect(phoneSchema.parse(" +389 (70) 123-456 ")).toBe("+38970123456");
    expect(phoneSchema.parse("070 123 456")).toBe("070123456");
  });
  it.each(["", "123", "1234567890123456", "abc1234567", "+389<script>", null])("rejects unusable phone %s", phone => {
    expect(phoneSchema.safeParse(phone).success).toBe(false);
  });
  it.each(["https://facebook.com/student", "https://instagram.com/student", "https://x.com/student", "https://mastodon.social/@student", ""])("accepts optional social profile %s", socialUrl => {
    expect(contactSchema.safeParse({phone:"+38970123456",socialUrl}).success).toBe(true);
  });
  it.each(["javascript:alert(1)", "data:text/html,test", "http://x.com/student", "https://user:password@x.com/student", "not a URL"])("does not render unsafe profile %s", url => {
    expect(safeSocialUrl(url)).toBeNull();
  });
});
