CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TABLE "cards" (
	"scryfall_id" uuid PRIMARY KEY NOT NULL,
	"oracle_id" uuid NOT NULL,
	"name" text NOT NULL,
	"set_code" text NOT NULL,
	"collector_number" text NOT NULL,
	"mana_cost" text,
	"type_line" text,
	"oracle_text" text,
	"colors" text[],
	"cmc" numeric,
	"image_normal" text,
	"image_small" text,
	"image_art_crop" text,
	"price_usd" numeric,
	"price_usd_foil" numeric,
	"price_eur" numeric,
	"price_tix" numeric,
	"legalities" jsonb,
	"scryfall_uri" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_json" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deck_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"board" text DEFAULT 'main' NOT NULL,
	"foil" boolean DEFAULT false NOT NULL,
	CONSTRAINT "uq_deck_cards_deck_card_board_foil" UNIQUE("deck_id","card_id","board","foil"),
	CONSTRAINT "quantity_positive" CHECK ("deck_cards"."quantity" > 0),
	CONSTRAINT "board_check" CHECK ("deck_cards"."board" in ('main','side','maybe','commander'))
);
--> statement-breakpoint
CREATE TABLE "deck_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_deck_versions_deck_version" UNIQUE("deck_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"format" text,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"notes" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_check" CHECK ("decks"."status" in ('in_progress','complete','archived'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_card_id_cards_scryfall_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("scryfall_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_versions" ADD CONSTRAINT "deck_versions_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cards_name_trgm" ON "cards" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_cards_oracle_id" ON "cards" USING btree ("oracle_id");--> statement-breakpoint
CREATE INDEX "idx_deck_cards_deck_id" ON "deck_cards" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "idx_deck_versions_deck_id" ON "deck_versions" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "idx_decks_user_id" ON "decks" USING btree ("user_id");