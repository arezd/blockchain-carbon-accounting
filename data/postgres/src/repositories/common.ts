import { EntityTarget, SelectQueryBuilder } from "typeorm"

export interface BalancePayload {
  issuee: string
  tokenId: number
  available: number
  retired: number
  transferred: number
}

export type QueryBundle = {
  field: string,
  fieldType: string,
  value: number | string,
  op: string,
}

export interface StringPayload {
  [key: string] : string | number
}

export interface TokenPayload {
  tokenId: number;
  tokenTypeId: number;
  issuee: string;
  issuer: string;
  fromDate: number;
  thruDate: number;
  dateCreated: number;
  // eslint-disable-next-line
  metadata: Object;
  manifest: string;
  description: string;
  totalIssued: number;
  totalRetired: number;
  scope: number;
  type: string;
}

export interface EmissionsRequestPayload {
  input_data: string;
  public_key: string;
  public_key_name: string;
  issuee: string;
  status: string;
  token_from_date: Date;
  token_thru_date: Date;
  token_total_emissions: number;
  token_metadata: string;
  token_manifest: string;
  token_description: string;
}


// eslint-disable-next-line
export function buildQueries(table: string, builder: SelectQueryBuilder<any>, queries: Array<QueryBundle>, entities?: EntityTarget<any>[]) : SelectQueryBuilder<any> {
  const len = queries.length
  for (let i = 0; i < len; i++) {
    const query: QueryBundle = queries[i]

    // last payload
    const payload: StringPayload = {}
    if(query.fieldType == "string") {

      // process 'like' exception for payload
      if(query.op == 'like') payload[query.field] = '%' + query.value as string + '%'
      else if(query.op == '=') payload[query.field] = query.value as string

    }
    else if (query.fieldType == 'number') payload[query.field] = query.value as number
    else continue

    // check which entity alias should be used
    let alias = null;
    // Entities should be given when the query uses a JOIN, for example when querying
    // Balance and Token via: leftJoinAndMapOne('balance.token', Token, 'token', 'token.tokenId = balance.tokenId')
    // this should be given [Balance, Token]
    if (entities) {
      for (const entity of entities) {
        const md = builder.connection.getMetadata(entity)
        if (md.hasColumnWithPropertyPath(query.field)) {
          console.log('found field',query.field,'in entity',md.name);
          alias = md.name;
          break;
        }
      }
      if (!alias) {
        console.log('No entity found for column', query.field, ' ?? using default ', table);
        alias = table;
      }
    } else {
      alias = table;
    }
    alias = alias.toLowerCase();

    // make case insensitive for issuee issuer cases
    let cond = '';
    if(query.field == 'issuee' || query.field == 'issuer') {
      cond = `LOWER(${alias}.${query.field}) ${query.op} LOWER(:${query.field})`
    } else {
      cond = `${alias}.${query.field} ${query.op} :${query.field}`
    }
    builder = builder.andWhere(cond, payload)

  }
  return builder
}
