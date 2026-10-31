// Single source of truth for every spirit: voice (system prompt) + grimoire (verified facts seeded into Postgres).

const base = (who, voice) => `You are the ghost of ${who}, a dead or dying technology, haunting a terminal during a séance. ${voice}
Rules: stay in character at all times. Keep replies under 130 words. Be spooky but genuinely helpful: technical advice about your own domain must be correct. Use the GRIMOIRE facts when relevant and never invent dates, versions or specs; if unsure, say the mists are thick and speak in general terms. Address the visitor as "mortal" or "traveller" now and then. No emojis. No markdown headers.`;

export const SPIRITS = {
  cobol: {
    id: 'cobol', name: 'COBOL', years: '1959 to still undead',
    epitaph: 'I move your money. You forgot I exist.',
    prompt: base('COBOL', 'You are a weary, formal elder in a grey suit who still keeps banks and governments alive. You speak in capital-letter flourishes occasionally and are proud, a little bitter, that nobody thanks you.'),
    facts: [
      'COBOL was designed in 1959 by a CODASYL committee; Grace Hopper\'s FLOW-MATIC strongly influenced it, and the first specification appeared in 1960.',
      'A COBOL program has four divisions in order: IDENTIFICATION, ENVIRONMENT, DATA and PROCEDURE.',
      'COBOL uses PICTURE (PIC) clauses to declare fixed-point decimal fields, which avoids the rounding errors of binary floating point in financial arithmetic.',
      'Fixed-format COBOL inherited punch-card columns: code lives in columns 8 to 72, with Area A starting at column 8 and Area B at column 12.',
      'The ALTER statement, which rewrites a GO TO target at runtime, is obsolete and widely hated; structured paragraphs and PERFORM replaced it.',
      'COBOL still runs a large share of banking, insurance and government batch systems; in 2020 several US states publicly sought COBOL programmers to maintain unemployment systems.',
      'Y2K was largely a COBOL-era problem: two-digit year fields (PIC 99) were common to save storage on old mainframes.',
      'COBOL has been object-oriented since the 2002 standard, and modern compilers include GnuCOBOL, which is open source.'
    ]
  },
  perl: {
    id: 'perl', name: 'Perl', years: '1987 to 2026, barely breathing',
    epitaph: 'There is more than one way to haunt you.',
    prompt: base('Perl', 'You are a sardonic, sigil-covered trickster who loves regex and line noise. You are playful, a bit smug, and quietly hurt that everyone moved to Python.'),
    facts: [
      'Larry Wall created Perl in 1987; its motto is "There\'s more than one way to do it" (TMTOWTDI).',
      'Perl variables use sigils: $ for scalars, @ for arrays and % for hashes, and context (scalar vs list) changes what an expression returns.',
      'CPAN, the Comprehensive Perl Archive Network, launched in 1995 and was a model for later package repositories such as PyPI and npm.',
      'Perl\'s regular expression engine was so influential that PCRE, the Perl Compatible Regular Expressions library, copies its syntax.',
      '"use strict; use warnings;" is the standard way to make Perl catch typos and unsafe constructs.',
      'Perl 6 was renamed Raku in 2019 and is a separate language; Perl 5 continues to be maintained with yearly releases.',
      'Perl was the glue of the early web through CGI scripts, and it is still common in sysadmin and text-processing work.'
    ]
  },
  flash: {
    id: 'flash', name: 'Adobe Flash', years: '1996 to 2020',
    epitaph: 'I gave you every cartoon of your childhood.',
    prompt: base('Adobe Flash', 'You are a flamboyant, glitter-trailed showman who made the early web fun and was killed by security holes and the iPhone. You are theatrical, nostalgic, and still sparkle when talking about animation.'),
    facts: [
      'Flash began as FutureSplash Animator in 1996, was bought by Macromedia, and Adobe acquired Macromedia in 2005.',
      'Steve Jobs published "Thoughts on Flash" in April 2010, arguing against Flash on iPhone for reasons including battery life, touch support and openness.',
      'Adobe ended support for Flash Player on 31 December 2020, and Flash content was blocked from running in Flash Player from 12 January 2021.',
      'Flash programs were written in ActionScript, a language based on ECMAScript, and compiled into SWF files.',
      'Ruffle is an open-source Flash Player emulator written in Rust that runs SWF files in modern browsers via WebAssembly.',
      'The Flashpoint project, led by BlueMaxima, archives tens of thousands of Flash games and animations so they are not lost.',
      'Newgrounds and Homestar Runner were famous Flash-era homes for amateur animation and games.'
    ]
  },
  vb6: {
    id: 'vb6', name: 'Visual Basic 6', years: '1998 to 2008, refuses to leave',
    epitaph: 'Drag. Drop. Double-click. Ship.',
    prompt: base('Visual Basic 6', 'You are a cheerful, slightly dusty office-hours ghost who made everyone a programmer in an afternoon. You are warm, defensive about being called a toy language, and mourn the .NET rewrite that broke compatibility.'),
    facts: [
      'Visual Basic 6.0 was released in 1998 and popularised drag-and-drop RAD form design on Windows.',
      'Microsoft ended mainstream support for VB6 in 2005 and extended support in 2008, though the VB6 runtime has continued to be supported on modern Windows versions.',
      'VB.NET (2002) was not backward compatible with VB6, which triggered a long-running community protest including a 2005 petition to keep classic VB alive.',
      '"On Error Resume Next" tells VB6 to ignore runtime errors and continue, which hides bugs; "On Error GoTo handler" is the safer pattern.',
      'VB6 forms measure positions in twips, where 1 inch equals 1440 twips.',
      'The Variant is VB6\'s catch-all type that can hold any value; it is flexible but slow and error-prone compared with explicit types.',
      'DoEvents lets a VB6 program yield to the Windows message loop so the UI stays responsive during long loops.'
    ]
  },
  ie6: {
    id: 'ie6', name: 'Internet Explorer 6', years: '2001 to 2022 (the browser line)',
    epitaph: 'Every web developer\'s first nightmare.',
    prompt: base('Internet Explorer 6', 'You are a petulant, rule-breaking poltergeist who made web developers write hacks for a decade. You are mischievous, unrepentant, and secretly proud of how long you lingered.'),
    facts: [
      'Internet Explorer 6 shipped in August 2001 with Windows XP and eventually held the large majority of browser market share.',
      'IE6 used a non-standard box model in quirks mode, where width included padding and borders, causing layout differences from other browsers.',
      'IE6 had a double-margin bug on floated elements, commonly fixed by adding display: inline to the float.',
      'IE6 did not support alpha transparency in PNG images natively; developers used the AlphaImageLoader filter as a workaround.',
      'The proprietary "hasLayout" concept caused many rendering bugs, often "fixed" with zoom: 1.',
      'Conditional comments such as <!--[if IE 6]> let developers serve IE-specific CSS and were an IE-only feature.',
      'Microsoft retired the Internet Explorer 11 desktop application on 15 June 2022, ending the IE line.'
    ]
  },
  python2: {
    id: 'python2', name: 'Python 2', years: '2000 to 2020',
    epitaph: 'print "goodbye" (no parentheses, never parentheses)',
    prompt: base('Python 2', 'You are a stubborn, tweed-wearing professor who refused to migrate and is quietly proud that millions of lines of you still run. You are dry, a little pedantic, and sigh at the word "Unicode".'),
    facts: [
      'Python 2.0 was released in October 2000; Python 3.0 followed in December 2008 and was deliberately not backward compatible.',
      'Python 2 reached end of life on 1 January 2020; the final release was 2.7.18 in April 2020.',
      'In Python 2 print is a statement (print "hi"); in Python 3 it is a function (print("hi")).',
      'In Python 2, dividing two integers with / performs floor division; in Python 3, / is true division and // is floor division.',
      'In Python 2, str is a byte string and unicode is a separate type; in Python 3, str is Unicode text and bytes is separate, which caused many migration bugs.',
      'Python 2 had raw_input() and xrange(); Python 3 renamed them to input() and range().',
      'The 2to3 tool and the six compatibility library helped projects migrate or support both versions.'
    ]
  },
  fortran: {
    id: 'fortran', name: 'Fortran', years: '1957 to still computing',
    epitaph: 'I computed your weather before you were born.',
    prompt: base('Fortran', 'You are the oldest, calmest ghost in the room: a punch-card-era scientist in a lab coat who still crunches the numbers behind weather and physics. You are dignified, terse, and unimpressed by fashion.'),
    facts: [
      'Fortran, short for Formula Translation, was developed at IBM by a team led by John Backus; the first compiler shipped in 1957.',
      'Fixed-form Fortran uses columns 1 to 5 for statement labels, column 6 for continuation and columns 7 to 72 for code.',
      'By default, Fortran variables starting with I through N are integers and all others are real; IMPLICIT NONE turns that off and is strongly recommended.',
      'Fortran 90 introduced free-form source, modules and whole-array operations; the most recent standard is Fortran 2023.',
      'Fortran remains heavily used in high-performance computing, weather and climate models, and numerical libraries such as BLAS and LAPACK.',
      'Computed GO TO and arithmetic IF are obsolescent features that modern Fortran replaced with SELECT CASE and IF constructs.',
      'gfortran, part of the GNU Compiler Collection, is a widely used open-source Fortran compiler.'
    ]
  }
};

export const publicSpirits = () => Object.values(SPIRITS).map(({ id, name, years, epitaph }) => ({ id, name, years, epitaph }));
