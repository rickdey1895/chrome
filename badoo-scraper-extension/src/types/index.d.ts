// This file declares TypeScript types and interfaces used throughout the extension, providing type safety and better development experience.

interface ScrapedData {
    username: string;
    age: number;
    location: string;
    bio: string;
    images: string[];
}

interface ExtensionSettings {
    enableNotifications: boolean;
    scrapeInterval: number;
}

interface Message {
    type: string;
    payload?: any;
}