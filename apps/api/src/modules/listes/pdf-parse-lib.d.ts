/**
 * `pdf-parse` 1.1.1 : son `index.js` entre en « mode débogage » (il lit un fichier de test) dès qu'il est chargé sans
 * `module.parent`, ce qui est le cas sous `import()`. On charge donc la bibliothèque elle-même, `lib/pdf-parse.js`, avec
 * les types du paquet `@types/pdf-parse`.
 */
declare module 'pdf-parse/lib/pdf-parse.js' {
  import pdfParse from 'pdf-parse';
  export default pdfParse;
}
