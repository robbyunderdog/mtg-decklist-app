import type { Request, Response } from "express";
import { z } from "zod";
import * as cardCache from "../services/scryfall/cache.js";
import { ScryfallNotFoundError } from "../services/scryfall/client.js";
import { requireParam } from "../utils/params.js";

const searchQuerySchema = z.object({ q: z.string().min(1) });

export async function search(req: Request, res: Response) {
  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing search query" });
    return;
  }

  try {
    const results = await cardCache.searchCardsLive(parsed.data.q);
    res.json({ cards: results });
  } catch (err) {
    if (err instanceof ScryfallNotFoundError) {
      res.json({ cards: [] });
      return;
    }
    throw err;
  }
}

export async function getById(req: Request, res: Response) {
  const scryfallId = requireParam(req.params.scryfallId, "card id");

  try {
    const card = await cardCache.findCardById(scryfallId);
    res.json({ card });
  } catch (err) {
    if (err instanceof ScryfallNotFoundError) {
      res.status(404).json({ error: "Card not found" });
      return;
    }
    throw err;
  }
}
