import { RegExpMatcher, TextCensor, englishDataset, englishRecommendedTransformers } from 'obscenity';

// This class is a singleton profanity filter for filtering words
class ProfanityFilter {
    static instance = null;
    static matcher = null;
    static censor = null;

    // Singleton pattern to ensure only one instance exists
    constructor() {
        if (!ProfanityFilter.instance) {
            console.log('Initializing ProfanityFilter singleton instance.');
            ProfanityFilter.instance = this;
            ProfanityFilter.matcher = new RegExpMatcher({
                ...englishDataset.build(),
                ...englishRecommendedTransformers,
            });
            ProfanityFilter.censor = new TextCensor();
        }
        return ProfanityFilter.instance;
    }

    // Checks if the text contains profane words and returns them
    isProfane(text) {
        const matches = ProfanityFilter.matcher.getAllMatches(text);
        const badWords = [];
        if (matches.length > 0) {
            for (const match of matches) {
                const { phraseMetadata } = englishDataset.getPayloadWithPhraseMetadata(match);
                badWords.push(phraseMetadata.originalWord);
            }
            return { badWords };
        }
        return { badWords: [] };
    }

    // Returns a censored version of the text, replacing profane words with asterisks
    censorText(text) {
        const isProfaneResult = this.isProfane(text);
        if (isProfaneResult.badWords.length === 0) {
            return text; // No profanity found, return original text
        }
        return ProfanityFilter.censor.applyTo(text, isProfaneResult.badWords);
    }
}

export default new ProfanityFilter();
