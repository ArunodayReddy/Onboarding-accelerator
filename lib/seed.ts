/**
 * Fictional client extracts for "Harborline Freight", a regional 3PL.
 *
 * These are deliberately messy the way real day-one client data is:
 * four different date formats, inconsistent casing ("chicago" vs "CHICAGO"),
 * typo'd statuses ("delviered"), currency-formatted numbers, and missing
 * values. The pipeline's job is to find all of it and normalize it away.
 */
import { parseCsv } from "./csv";
import { profileDataset } from "./infer";
import type { Dataset } from "./types";

const SHIPMENTS_CSV = `ShipmentID,origin,Destination,pickup_date,PromisedDate,DeliveryDate,carrier_name,Status,Weight_lbs,Cost_USD,miles
SHP-1001,Chicago,Columbus,2026-09-01,2026-09-03,2026-09-03,Blue Ridge Carriers,delivered,18500,1450.00,355
SHP-1002,chicago,Indianapolis,09/02/2026,09/04/2026,09/05/2026,Crosswind Logistics,delviered,22000,"$1,780.50",412
SHP-1003,Louisville,Nashville,Sep 3 2026,Sep 5 2026,Sep 5 2026,Ironline Transport,Delivered,12000,980,175
SHP-1004,Detroit,CHICAGO,2026-09-04,2026-09-06,,Lakeshore Freight,In-Transit,30000,2100,285
SHP-1005,Columbus,St. Louis,09/05/2026,09/08/2026,09/09/2026,Summit Haul Co.,delivered,16500,1520.75,430
SHP-1006,Nashville,Louisville,2026-09-06,2026-09-08,2026-09-07,TrueNorth Shipping,DELIVERED,9800,720,175
SHP-1007,Indianapolis,Chicago,Sep 7 2026,Sep 9 2026,,Blue Ridge Carriers,in_transit,24000,1890,185
SHP-1008,Cleveland,Detroit,2026-09-08,2026-09-10,2026-09-12,Crosswind Logistics,Delivered,14000,"$1,120.00",170
SHP-1009,St. Louis,Columbus,09/09/2026,09/11/2026,09/11/2026,Ironline Transport,delivered,19500,1640,430
SHP-1010,Chicago,Nashville,2026-09-10,2026-09-13,,Lakeshore Freight,booked,11000,1350,470
SHP-1011,Columbus,chicago,8-Sep-2026,10-Sep-2026,10-Sep-2026,Summit Haul Co.,delivered,27000,1980.25,355
SHP-1012,Louisville,Indianapolis,2026-09-12,2026-09-14,2026-09-15,TrueNorth Shipping,delviered,13500,1010,115
SHP-1013,Detroit,Cleveland,09/13/2026,09/15/2026,,Blue Ridge Carriers,IN TRANSIT,21000,1560,170
SHP-1014,Nashville,St. Louis,2026-09-14,2026-09-16,2026-09-16,Crosswind Logistics,delivered,17000,1490,310
SHP-1015,Indianapolis,Louisville,Sep 15 2026,Sep 17 2026,Sep 18 2026,Ironline Transport,Delivered,10500,"$860.40",115
SHP-1016,Chicago,Detroit,2026-09-16,2026-09-18,,Lakeshore Freight,in-transit,26000,1740,285
SHP-1017,Cleveland,Columbus,09/17/2026,09/19/2026,09/19/2026,Summit Haul Co.,delivered,15500,1180,145
SHP-1018,St. Louis,Nashville,2026-09-18,2026-09-20,2026-09-22,TrueNorth Shipping,delivered,19000,1620,310
SHP-1019,Louisville,Chicago,Sep 19 2026,Sep 21 2026,,Blue Ridge Carriers,booked,12500,1420,295
SHP-1020,Columbus,Detroit,2026-09-20,2026-09-22,2026-09-21,Crosswind Logistics,DELIVERED,23000,1690.80,190
SHP-1021,Indianapolis,Cleveland,09/21/2026,09/23/2026,09/24/2026,Ironline Transport,delviered,14800,1240,250
SHP-1022,Detroit,Indianapolis,2026-09-22,2026-09-24,,Lakeshore Freight,In Transit,20500,,240
SHP-1023,Nashville,Columbus,Sep 23 2026,Sep 25 2026,Sep 25 2026,Summit Haul Co.,delivered,16200,1380,390
SHP-1024,Chicago,St. Louis,2026-09-24,2026-09-26,2026-09-27,TrueNorth Shipping,Delivered,11800,"$940.60",300
SHP-1025,Louisville,Detroit,09/25/2026,09/27/2026,,Blue Ridge Carriers,cancelled,17500,0,380
SHP-1026,Columbus,Louisville,2026-09-26,2026-09-28,2026-09-28,Crosswind Logistics,delivered,13200,890,205
SHP-1027,Cleveland,Chicago,27-Sep-2026,29-Sep-2026,,Ironline Transport,in_transit,24500,1810,345
SHP-1028,St. Louis,Indianapolis,2026-09-28,2026-09-30,2026-10-01,Lakeshore Freight,delivered,15800,1470.30,240
SHP-1029,Detroit,Nashville,09/29/2026,10/01/2026,,Summit Haul Co.,booked,18700,1730,530
SHP-1030,Indianapolis,St. Louis,2026-09-30,2026-10-02,2026-10-02,TrueNorth Shipping,Delivered,10900,920,240`;

const CARRIERS_CSV = `carrier_id,CarrierName,mc_number,fleet_size,on_time_pct
C-01,Blue Ridge Carriers,MC-884102,120,96.4
C-02,Crosswind Logistics,MC-771205,85,93.1
C-03,Ironline Transport,MC-550981,200,97.8
C-04,Lakeshore Freight,MC-330477,64,91.2
C-05,Summit Haul Co.,MC-912346,150,95.0
C-06,TrueNorth Shipping,MC-208833,97,94.6`;

const FACILITIES_CSV = `facility_code,City,State,type,capacity_pallets
CHI-01,Chicago,IL,cross_dock,12000
CMH-01,Columbus,OH,warehouse,25000
IND-01,Indianapolis,IN,warehouse,18000
LOU-01,Louisville,KY,cross_dock,9000
BNA-01,Nashville,TN,warehouse,21000`;

function toDataset(
  id: string,
  name: string,
  entity: string,
  csv: string
): Dataset {
  const { columns, rows } = parseCsv(csv);
  return {
    id,
    name,
    entity,
    rowCount: rows.length,
    columns,
    rows,
    profile: profileDataset(columns, rows),
  };
}

export function loadSeedDatasets(): Dataset[] {
  return [
    toDataset("shipments", "shipments_sep2026.csv", "Shipment", SHIPMENTS_CSV),
    toDataset("carriers", "carriers.csv", "Carrier", CARRIERS_CSV),
    toDataset("facilities", "facilities.csv", "Facility", FACILITIES_CSV),
  ];
}
