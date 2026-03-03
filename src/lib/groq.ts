import Groq from "groq-sdk";

let groqInstance: Groq | null = null;

export function getGroq(): Groq {
    if (!groqInstance) {
        groqInstance = new Groq({
            apiKey: process.env.GROQ_API_KEY,
        });
    }
    return groqInstance;
}

export const groq = new Proxy({} as Groq, {
    get(_target, prop) {
        return Reflect.get(getGroq(), prop);
    },
});

export const GROQ_MODEL = "llama-3.3-70b-versatile";
