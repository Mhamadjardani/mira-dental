import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RichText } from "@/components/ChatWidget";

describe("chat RichText", () => {
  it("turns '- ' lines into a list and keeps bold", () => {
    const html = renderToStaticMarkup(<RichText text={"Free on Thursday:\n- **13:30**\n- 14:15\n\nWhich works?"} />);
    expect(html).toBe('<p class="mt-2 first:mt-0">Free on Thursday:</p><ul class="my-1.5 list-disc space-y-0.5 ps-5 first:mt-0 last:mb-0"><li><strong>13:30</strong></li><li>14:15</li></ul><p class="mt-2 first:mt-0">Which works?</p>');
  });
});
