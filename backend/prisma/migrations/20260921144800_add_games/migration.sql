-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('uno', 'ludo');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('waiting', 'playing', 'finished');

-- CreateTable
CREATE TABLE "game_rooms" (
    "id" TEXT NOT NULL,
    "hostel_id" TEXT NOT NULL,
    "game_type" "GameType" NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'waiting',
    "code" TEXT NOT NULL,
    "host_id" TEXT NOT NULL,
    "max_players" INTEGER NOT NULL,
    "state" JSONB NOT NULL,
    "current_turn_user_id" TEXT,
    "winner_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_room_players" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "seat" INTEGER NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_room_players_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_rooms_code_key" ON "game_rooms"("code");

-- CreateIndex
CREATE INDEX "game_rooms_hostel_id_status_idx" ON "game_rooms"("hostel_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "game_room_players_room_id_user_id_key" ON "game_room_players"("room_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_room_players_room_id_seat_key" ON "game_room_players"("room_id", "seat");

-- AddForeignKey
ALTER TABLE "game_rooms" ADD CONSTRAINT "game_rooms_hostel_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "hostels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_room_players" ADD CONSTRAINT "game_room_players_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "game_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_room_players" ADD CONSTRAINT "game_room_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
