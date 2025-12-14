import { app } from "electron";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import type { Profile } from "../../types/ipc";

export class ProfileManager {
  private static profilesDir: string;

  static async initialize(): Promise<void> {
    const userDataPath = app.getPath("userData");
    this.profilesDir = path.join(userDataPath, "profiles");

    try {
      await fs.mkdir(this.profilesDir, { recursive: true });
    } catch (error) {
      console.error("Failed to create profiles directory:", error);
      throw error;
    }
  }

  static async listProfiles(): Promise<Profile[]> {
    try {
      const files = await fs.readdir(this.profilesDir);
      const profiles: Profile[] = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = path.join(this.profilesDir, file);
          const content = await fs.readFile(filePath, "utf-8");
          const profile = JSON.parse(content) as Profile;
          profiles.push(profile);
        }
      }

      return profiles.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
      console.error("Failed to list profiles:", error);
      return [];
    }
  }

  static async saveProfile(
    profileData: Omit<Profile, "id" | "createdAt" | "updatedAt">,
  ): Promise<Profile> {
    const profile: Profile = {
      id: randomUUID(),
      ...profileData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const profilePath = path.join(this.profilesDir, `${profile.id}.json`);
    await fs.writeFile(profilePath, JSON.stringify(profile, null, 2), "utf-8");

    return profile;
  }

  static async updateProfile(
    profileId: string,
    updates: Partial<Omit<Profile, "id" | "createdAt">>,
  ): Promise<Profile> {
    const existing = await this.loadProfile(profileId);

    const updated: Profile = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    const profilePath = path.join(this.profilesDir, `${profileId}.json`);
    await fs.writeFile(profilePath, JSON.stringify(updated, null, 2), "utf-8");

    return updated;
  }

  static async loadProfile(profileId: string): Promise<Profile> {
    const profilePath = path.join(this.profilesDir, `${profileId}.json`);

    try {
      const content = await fs.readFile(profilePath, "utf-8");
      return JSON.parse(content) as Profile;
    } catch (error) {
      throw new Error(
        `Failed to load profile: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  static async deleteProfile(profileId: string): Promise<void> {
    const profilePath = path.join(this.profilesDir, `${profileId}.json`);
    await fs.unlink(profilePath);
  }
}
