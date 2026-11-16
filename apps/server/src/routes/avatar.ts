import { FastifyInstance } from "fastify";
import { createAvatar } from "@dicebear/core";
import { avataaars, bottts, identicon, lorelei, notionists, openPeeps, thumbs } from "@dicebear/collection";

// Self-hosted DiceBear: api.dicebear.com is non-commercial only. Same URL shape: /api/avatar/<style>/svg?seed=...
// Public on purpose: <img> tags can't send auth headers, and output depends only on the seed.
// Only styles free for commercial use with no attribution (CC0 or artist's free terms); CC BY styles left out on purpose.
const STYLES = { avataaars, bottts, identicon, lorelei, notionists, "open-peeps": openPeeps, thumbs } as const;

export async function avatarRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { style: string }; Querystring: { seed?: string; backgroundColor?: string } }>(
    "/:style/svg",
    async (request, reply) => {
      const style = STYLES[request.params.style as keyof typeof STYLES];
      if (!style) return reply.status(404).send({ error: "Unknown avatar style" });

      const seed = String(request.query.seed ?? "").slice(0, 100);
      const bg = request.query.backgroundColor;
      const svg = createAvatar(style as any, {
        seed,
        ...(bg && /^[0-9a-fA-F]{6}$/.test(bg) ? { backgroundColor: [bg] } : {}),
      }).toString();

      return reply
        .header("Content-Type", "image/svg+xml")
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .send(svg);
    },
  );
}
