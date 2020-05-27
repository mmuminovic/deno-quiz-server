import { hash, compare } from "https://deno.land/x/bcrypt/mod.ts";

export default {
  bcrypt: (stringToHash: string): Promise<string> => {
    const hashedPw = hash(stringToHash);
    return hashedPw;
  },
  verify: (hashedPw: string, text: string): Promise<boolean> => {
    const result = compare(text, hashedPw);
    return result;
  },
};
