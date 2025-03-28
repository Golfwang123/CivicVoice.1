// Types for modules without type definitions

declare module 'connect-sqlite3' {
  import session from 'express-session';
  
  function connectSqlite3(session: any): {
    new (options?: any): session.Store;
  };
  
  export = connectSqlite3;
}